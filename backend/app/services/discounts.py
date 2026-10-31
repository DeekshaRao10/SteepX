from decimal import Decimal

from sqlalchemy import select

from app.models.billing import DiscountRule, TaxRate
from app.schemas.billing import DiscountResponse, TaxResponse
from app.services.common import conflict, flush_unique, get_record, page
from app.services.pricing import ZERO, money


def discount_amount(rule, subtotal, quantity, currency, on_date):
    reason = None
    if not rule.is_active: reason = "inactive"
    elif rule.currency != currency: reason = "currency_mismatch"
    elif rule.starts_on and on_date < rule.starts_on: reason = "not_started"
    elif rule.ends_on and on_date > rule.ends_on: reason = "expired"
    elif subtotal < rule.minimum_purchase: reason = "minimum_purchase"
    elif quantity < rule.minimum_quantity: reason = "minimum_quantity"
    elif rule.usage_limit is not None and rule.used_count >= rule.usage_limit: reason = "usage_limit"
    if reason:
        return ZERO, reason
    value = rule.value if rule.kind == "fixed" else subtotal * rule.value / Decimal(100)
    return min(money(value), subtotal), "eligible"


def write_tax(session, data, rate_id=None):
    with session.begin():
        record = get_record(session, TaxRate, rate_id, lock=True) if rate_id else TaxRate()
        for key, value in data.model_dump().items(): setattr(record, key, value)
        session.add(record)
        flush_unique(session)
        return TaxResponse.model_validate(record)


def list_taxes(session, query):
    with session.begin():
        return page(session, select(TaxRate), TaxRate, query, TaxResponse, name_column=TaxRate.name)


def write_discount(session, data, discount_id=None):
    with session.begin():
        record = get_record(session, DiscountRule, discount_id, lock=True) if discount_id else DiscountRule()
        if discount_id and (record.code != data.code or record.currency != data.currency):
            raise conflict("Discount code and currency are immutable.")
        if discount_id and data.usage_limit is not None and data.usage_limit < record.used_count:
            raise conflict("The usage limit cannot be less than existing usage.")
        for key, value in data.model_dump().items(): setattr(record, key, value)
        session.add(record)
        flush_unique(session)
        return DiscountResponse.model_validate(record)


def list_discounts(session, query):
    with session.begin():
        return page(session, select(DiscountRule), DiscountRule, query, DiscountResponse, name_column=DiscountRule.code)


def rule_detail(session, model, record_id, schema):
    with session.begin():
        return schema.model_validate(get_record(session, model, record_id))
