from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.core.billing_dates import period_boundary
from app.core.errors import PublicError
from app.core.lifecycle import QUOTE_TRANSITIONS, SUBSCRIPTION_TRANSITIONS, transition
from app.models.catalog import CustomerProfile, ProductVariant, SubscriptionPlan
from app.models.commerce import Quotation, QuotationLine, QuotationTemplate, Subscription, SubscriptionLine
from app.models.user import User, UserRole
from app.models.billing import DiscountRule, TaxRate
from app.services.discounts import discount_amount
from app.schemas.commerce import LineSelection, QuotationResponse, SubscriptionResponse, TemplateResponse
from app.services.common import conflict, customer_scope, flush_unique, get_record, missing, owned, page, today
from app.services.pricing import calculate


def customer_for_quote(session, identity, requested_id):
    if identity.profile.role == UserRole.CUSTOMER:
        if requested_id is not None:
            raise PublicError(403, "forbidden", "Customer identity is derived from your authenticated account.")
        customer_id = identity.profile.id
    else:
        if requested_id is None:
            raise PublicError(422, "validation_error", "A customer_id is required for an operator-created quotation.")
        customer_id = requested_id
    customer = get_record(session, CustomerProfile, customer_id)
    user = get_record(session, User, customer_id)
    if not customer.is_active or not user.is_active or user.role != UserRole.CUSTOMER:
        raise conflict("This customer cannot start a new agreement.")
    return customer_id


def price_selections(session, selections, start_date):
    plan_ids = {selection.plan_id for selection in selections}
    plans = {plan.id: plan for plan in session.scalars(select(SubscriptionPlan).where(SubscriptionPlan.id.in_(plan_ids))
                                                     .options(joinedload(SubscriptionPlan.product)))}
    variant_ids = {identifier for selection in selections for identifier in selection.variant_ids}
    variants = {variant.id: variant for variant in session.scalars(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))}
    tax_ids = {plan.tax_rate_id for plan in plans.values() if plan.tax_rate_id}
    taxes = {rate.id: rate for rate in session.scalars(select(TaxRate).where(TaxRate.id.in_(tax_ids)))}
    result = []
    combinations = set()
    for position, selection in enumerate(selections):
        plan = plans.get(selection.plan_id)
        if (plan is None or not plan.is_active or not plan.product.is_active
                or (plan.available_from and max(start_date, today()) < plan.available_from)
                or (plan.available_until and max(start_date, today()) > plan.available_until)):
            raise conflict("A selected plan is inactive or unavailable for the agreement.")
        if selection.quantity < plan.minimum_quantity:
            raise conflict("A selected quantity is below the plan minimum.")
        chosen = []
        for identifier in selection.variant_ids:
            variant = variants.get(identifier)
            if variant is None or variant.product_id != plan.product_id or not variant.is_active:
                raise conflict("A selected variant is unavailable for this plan's product.")
            chosen.append({"id": str(variant.id), "name": variant.name, "kind": variant.kind,
                           "additional_price": str(variant.additional_price)})
        if sum(item["kind"] == "variant" for item in chosen) > 1:
            raise conflict("Select at most one variant and any permitted add-ons per line.")
        unit_price = plan.price + sum((Decimal(item["additional_price"]) for item in chosen), Decimal(0))
        tax_rate = Decimal(0)
        if plan.tax_rate_id:
            rate = taxes.get(plan.tax_rate_id)
            if rate is None or not rate.is_active:
                raise conflict("A selected plan has an unavailable tax rate.")
            tax_rate = rate.rate
        result.append(dict(position=position, plan_id=plan.id, quantity=selection.quantity,
            description=f"{plan.product.name} / {plan.name}" + (" / " + ", ".join(v["name"] for v in chosen) if chosen else ""),
            unit_price=unit_price, tax_rate=tax_rate, selected_variants=chosen))
        combinations.add((plan.product.currency, plan.billing_interval, plan.end_behavior))
    if len(combinations) != 1:
        raise conflict("All lines must share currency, billing interval, and end behavior.")
    return result, next(iter(combinations))


def quote_response(record):
    values = {name: getattr(record, name) for name in QuotationResponse.model_fields if name != "is_expired"}
    return QuotationResponse(**values, is_expired=record.state in {"draft", "quotation"} and record.valid_until < today())


def subscription_state(record):
    if record.state in {"active", "paused"} and record.term_end and record.term_end <= today():
        return "closed"
    return record.state


def subscription_response(record):
    values = {name: getattr(record, name) for name in SubscriptionResponse.model_fields}
    values["state"] = subscription_state(record)
    return SubscriptionResponse(**values)


def write_quote(session, data, identity, quotation_id=None):
    with session.begin():
        if identity.profile.role == UserRole.CUSTOMER and data.start_date < today():
            raise PublicError(422, "validation_error", "Customers cannot backdate new agreements.")
        record = owned(session, Quotation, quotation_id, identity, lock=True) if quotation_id else Quotation(lines=[])
        if quotation_id and record.state != "draft":
            raise conflict("Only draft quotations can be edited.")
        customer_id = customer_for_quote(session, identity, data.customer_id)
        if quotation_id and record.customer_id != customer_id:
            raise conflict("A quotation's customer cannot be changed.")
        validity_days = 30
        selections = data.lines
        if data.template_id:
            template = get_record(session, QuotationTemplate, data.template_id)
            if not template.is_active:
                raise conflict("This quotation template is inactive.")
            selections = [LineSelection.model_validate(line) for line in template.selections]
            validity_days = template.validity_days
        priced, (currency, interval, behavior) = price_selections(session, selections, data.start_date)
        valid_until = data.valid_until or today() + timedelta(days=validity_days)
        if valid_until < today():
            raise PublicError(422, "validation_error", "A new quotation cannot already be expired.")
        record.customer_id, record.template_id = customer_id, data.template_id
        record.currency, record.billing_interval, record.end_behavior = currency, interval, behavior
        record.start_date, record.end_date, record.valid_until = data.start_date, data.end_date, valid_until
        record.notes = data.notes
        record.lines = [QuotationLine(**line) for line in priced]
        totals = calculate(record.lines)
        record.discount_id = None
        if data.discount_code:
            rule = session.scalar(select(DiscountRule).where(DiscountRule.code == data.discount_code))
            if rule is None:
                raise conflict("The requested discount is unavailable.")
            amount, reason = discount_amount(rule, totals.subtotal, sum(line.quantity for line in record.lines), currency, data.start_date)
            if reason != "eligible":
                raise conflict("The requested discount is not eligible for this quotation.")
            record.discount_id = rule.id
            totals = calculate(record.lines, amount)
        record.subtotal, record.discount, record.tax, record.total = totals.subtotal, totals.discount, totals.tax, totals.total
        session.add(record)
        session.flush()
        return quote_response(record)


def list_quotes(session, query, identity, state=None, customer_id=None):
    with session.begin():
        statement = customer_scope(select(Quotation).options(selectinload(Quotation.lines)), Quotation, identity)
        if state: statement = statement.where(Quotation.state == state)
        if customer_id: statement = statement.where(Quotation.customer_id == customer_id)
        return page(session, statement, Quotation, query, QuotationResponse, convert=quote_response)


def quote_detail(session, quotation_id, identity):
    with session.begin():
        return quote_response(owned(session, Quotation, quotation_id, identity))


def quote_action(session, quotation_id, identity, action):
    with session.begin():
        record = owned(session, Quotation, quotation_id, identity, lock=True)
        target = transition(record.state, action, QUOTE_TRANSITIONS)
        if target == record.state:
            return quote_response(record)
        if action in {"issue", "confirm"} and record.valid_until < today():
            raise conflict("This quotation has expired.")
        if action == "close" and session.scalar(select(Subscription.id).where(Subscription.quotation_id == record.id)):
            raise conflict("Close the associated subscription instead.")
        record.state = target
        session.flush()
        return quote_response(record)


def create_subscription(session, quotation_id, identity):
    with session.begin():
        quote = owned(session, Quotation, quotation_id, identity, lock=True)
        existing = session.scalar(select(Subscription).where(Subscription.quotation_id == quote.id).options(selectinload(Subscription.lines)))
        if existing:
            return subscription_response(existing)
        if quote.state != "confirmed":
            raise conflict("Only a confirmed quotation can create a subscription.")
        term_end = quote.end_date
        if quote.end_behavior == "close" and term_end is None:
            term_end = period_boundary(quote.start_date, quote.billing_interval, 1)
        record = Subscription(customer_id=quote.customer_id, quotation_id=quote.id, state="confirmed",
            discount_id=quote.discount_id,
            currency=quote.currency, billing_interval=quote.billing_interval, end_behavior=quote.end_behavior,
            start_date=quote.start_date, term_end=term_end, next_billing_date=quote.start_date,
            lines=[SubscriptionLine(**copy_line(line)) for line in quote.lines])
        session.add(record)
        session.flush()
        return subscription_response(record)


def copy_line(line):
    return {name: getattr(line, name) for name in ("position", "plan_id", "description", "quantity", "unit_price", "tax_rate", "selected_variants")}


def list_subscriptions(session, query, identity, state=None, customer_id=None):
    with session.begin():
        statement = customer_scope(select(Subscription).options(selectinload(Subscription.lines)), Subscription, identity)
        if state:
            from sqlalchemy import case, and_
            effective = case((and_(Subscription.state.in_(["active", "paused"]), Subscription.term_end <= today()), "closed"), else_=Subscription.state)
            statement = statement.where(effective == state)
        if customer_id: statement = statement.where(Subscription.customer_id == customer_id)
        return page(session, statement, Subscription, query, SubscriptionResponse, convert=subscription_response)


def subscription_detail(session, subscription_id, identity):
    with session.begin():
        return subscription_response(owned(session, Subscription, subscription_id, identity))


def subscription_action(session, subscription_id, identity, action):
    with session.begin():
        record = owned(session, Subscription, subscription_id, identity, lock=True)
        current = subscription_state(record)
        target = transition(current, action, SUBSCRIPTION_TRANSITIONS)
        if target == current and record.state == current:
            return subscription_response(record)
        if action == "activate":
            customer_for_quote(session, identity, record.customer_id if identity.profile.role != UserRole.CUSTOMER else None)
            if record.start_date > today() or (record.term_end and record.term_end <= today()):
                raise conflict("The subscription is not within its activation dates.")
            # Recheck availability without changing the agreed price snapshots.
            price_selections(session, [LineSelection(plan_id=line.plan_id, quantity=line.quantity,
                variant_ids=[v["id"] for v in line.selected_variants]) for line in record.lines], record.start_date)
        record.state = target
        if action == "pause": record.paused_at = datetime.now(UTC)
        if action == "resume": record.paused_at = None
        if action == "close": record.closed_on = today()
        if record.quotation_id:
            quote = get_record(session, Quotation, record.quotation_id, lock=True)
            if target == "active": quote.state = "active"
            if target == "closed": quote.state = "closed"
        session.flush()
        return subscription_response(record)


def renew_subscription(session, subscription_id, data, identity):
    with session.begin():
        source = owned(session, Subscription, subscription_id, identity, lock=True)
        existing = session.scalar(select(Subscription).where(Subscription.renewed_from_id == source.id).options(selectinload(Subscription.lines)))
        if existing:
            if existing.start_date != data.start_date or (data.end_date is not None and existing.term_end != data.end_date):
                raise conflict("This subscription has already been renewed with different dates.")
            return subscription_response(existing)
        if subscription_state(source) != "closed" or data.start_date < today():
            raise conflict("Only a closed subscription can renew, starting today or later.")
        customer_for_quote(session, identity, source.customer_id if identity.profile.role != UserRole.CUSTOMER else None)
        selections = [LineSelection(plan_id=line.plan_id, quantity=line.quantity,
            variant_ids=[v["id"] for v in line.selected_variants]) for line in source.lines]
        priced, (currency, interval, behavior) = price_selections(session, selections, data.start_date)
        source.state = "closed"
        if source.quotation_id:
            get_record(session, Quotation, source.quotation_id, lock=True).state = "closed"
        term_end = data.end_date or (period_boundary(data.start_date, interval, 1) if behavior == "close" else None)
        renewed = Subscription(customer_id=source.customer_id, renewed_from_id=source.id, state="confirmed",
            discount_id=source.discount_id,
            currency=currency, billing_interval=interval, end_behavior=behavior, start_date=data.start_date,
            term_end=term_end, next_billing_date=data.start_date, lines=[SubscriptionLine(**line) for line in priced])
        session.add(renewed)
        session.flush()
        return subscription_response(renewed)


def write_template(session, data, template_id=None):
    with session.begin():
        price_selections(session, data.selections, today())
        record = get_record(session, QuotationTemplate, template_id, lock=True) if template_id else QuotationTemplate()
        for key, value in data.model_dump(mode="json").items(): setattr(record, key, value)
        session.add(record)
        flush_unique(session)
        return TemplateResponse.model_validate(record)


def list_templates(session, query, identity):
    with session.begin():
        statement = select(QuotationTemplate)
        if identity.profile.role == UserRole.CUSTOMER: statement = statement.where(QuotationTemplate.is_active.is_(True))
        return page(session, statement, QuotationTemplate, query, TemplateResponse, name_column=QuotationTemplate.name)


def template_detail(session, template_id, identity):
    with session.begin():
        record = get_record(session, QuotationTemplate, template_id)
        if identity.profile.role == UserRole.CUSTOMER and not record.is_active:
            raise missing()
        return TemplateResponse.model_validate(record)
