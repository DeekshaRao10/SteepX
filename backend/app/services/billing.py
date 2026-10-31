from datetime import timedelta
from decimal import Decimal

from sqlalchemy import and_, case, select
from sqlalchemy.orm import selectinload

from app.core.billing_dates import period_boundary
from app.models.billing import DiscountRule, DiscountUsage, Invoice, InvoiceLine
from app.models.catalog import CustomerProfile
from app.models.commerce import Subscription
from app.models.user import User
from app.schemas.billing import InvoiceResponse
from app.services.commerce import copy_line
from app.services.common import conflict, customer_scope, get_record, owned, page, today
from app.services.discounts import discount_amount
from app.services.pricing import ZERO, calculate


def invoice_status_expression():
    return case((and_(Invoice.status == "confirmed", Invoice.due_date < today(), Invoice.amount_paid < Invoice.total), "overdue"), else_=Invoice.status)


def invoice_response(record):
    values = {name: getattr(record, name) for name in InvoiceResponse.model_fields if name != "outstanding_balance"}
    if record.status == "confirmed" and record.due_date < today() and record.amount_paid < record.total:
        values["status"] = "overdue"
    return InvoiceResponse(**values, outstanding_balance=record.total - record.amount_paid)


def generate_invoice(session, subscription_id, data, identity, settings):
    with session.begin():
        subscription = owned(session, Subscription, subscription_id, identity, lock=True)
        existing = session.scalar(select(Invoice).where(Invoice.subscription_id == subscription.id,
            Invoice.period_start == data.period_start).options(selectinload(Invoice.lines)))
        if existing:
            if (("issue_date" in data.model_fields_set and existing.issue_date != data.issue_date)
                    or (data.due_date is not None and existing.due_date != data.due_date)):
                raise conflict("This billing period already has an invoice with different dates.")
            return invoice_response(existing)
        if subscription.state not in {"active", "closed"}:
            raise conflict("Invoices require an active subscription or an unbilled period before closure.")
        if data.period_start != subscription.next_billing_date:
            raise conflict("Generate the earliest unbilled period shown by next_billing_date first.")
        if data.period_start > today():
            raise conflict("Future billing periods cannot be invoiced.")
        limits = [date for date in (subscription.term_end, subscription.closed_on) if date is not None]
        if limits and data.period_start >= min(limits):
            raise conflict("The requested period starts after the subscription ended.")
        index = subscription.next_period_index
        expected_start = period_boundary(subscription.start_date, subscription.billing_interval, index)
        next_boundary = period_boundary(subscription.start_date, subscription.billing_interval, index + 1)
        if data.period_start != expected_start:
            raise conflict("The billing schedule is inconsistent; generation was refused.")
        period_end = min([next_boundary] + limits)
        customer = get_record(session, CustomerProfile, subscription.customer_id)
        user = get_record(session, User, subscription.customer_id)
        initial = calculate(subscription.lines)
        applied = ZERO
        snapshot = {}
        rule = None
        if subscription.discount_id:
            rule = get_record(session, DiscountRule, subscription.discount_id, lock=True)
            applied, reason = discount_amount(rule, initial.subtotal, sum(line.quantity for line in subscription.lines),
                                              subscription.currency, data.period_start)
            snapshot = {"code": rule.code, "kind": rule.kind, "value": str(rule.value), "eligibility": reason}
        totals = calculate(subscription.lines, applied)
        invoice = Invoice(customer_id=subscription.customer_id, subscription_id=subscription.id,
            period_index=index, period_start=data.period_start, period_end=period_end,
            issue_date=data.issue_date, due_date=data.due_date or data.issue_date + timedelta(days=settings.billing_due_days),
            currency=subscription.currency, subtotal=totals.subtotal, discount=totals.discount, tax=totals.tax, total=totals.total,
            customer_snapshot={"display_name": customer.display_name, "company": customer.company,
                               "billing_address": customer.billing_address, "email": user.email},
            discount_snapshot=snapshot,
            lines=[InvoiceLine(**copy_line(line), **amounts) for line, amounts in zip(subscription.lines, totals.lines)])
        session.add(invoice)
        session.flush()
        if rule is not None and applied > 0:
            rule.used_count += 1
            session.add(DiscountUsage(discount_id=rule.id, invoice_id=invoice.id, amount=applied))
        subscription.next_period_index = index + 1
        subscription.next_billing_date = next_boundary
        session.flush()
        return invoice_response(invoice)


def invoice_detail(session, invoice_id, identity):
    with session.begin():
        return invoice_response(owned(session, Invoice, invoice_id, identity))


def list_invoices(session, query, identity, status=None, customer_id=None, subscription_id=None, date_from=None, date_to=None):
    if date_from and date_to and date_to < date_from:
        from app.core.errors import PublicError
        raise PublicError(422, "validation_error", "The date range is reversed.")
    with session.begin():
        statement = customer_scope(select(Invoice).options(selectinload(Invoice.lines)), Invoice, identity)
        if status: statement = statement.where(invoice_status_expression() == status)
        if customer_id: statement = statement.where(Invoice.customer_id == customer_id)
        if subscription_id: statement = statement.where(Invoice.subscription_id == subscription_id)
        if date_from: statement = statement.where(Invoice.issue_date >= date_from)
        if date_to: statement = statement.where(Invoice.issue_date <= date_to)
        return page(session, statement, Invoice, query, InvoiceResponse, convert=invoice_response)


def confirm_invoice(session, invoice_id, identity):
    with session.begin():
        invoice = owned(session, Invoice, invoice_id, identity, lock=True)
        if invoice.status == "draft":
            invoice.status = "paid" if invoice.total == 0 else "confirmed"
            session.flush()
        return invoice_response(invoice)
