from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.core.billing_dates import period_boundary
from app.services.discounts import discount_amount
from app.services.pricing import calculate


@pytest.mark.parametrize("anchor,interval,index,expected", [
    (date(2024, 1, 31), "monthly", 1, date(2024, 2, 29)),
    (date(2024, 1, 31), "monthly", 2, date(2024, 3, 31)),
    (date(2023, 1, 30), "monthly", 1, date(2023, 2, 28)),
    (date(2023, 1, 30), "monthly", 2, date(2023, 3, 30)),
    (date(2024, 4, 30), "monthly", 1, date(2024, 5, 31)),
    (date(2024, 2, 29), "yearly", 1, date(2025, 2, 28)),
    (date(2024, 2, 29), "yearly", 4, date(2028, 2, 29)),
    (date(2024, 12, 31), "daily", 1, date(2025, 1, 1)),
    (date(2024, 2, 28), "daily", 1, date(2024, 2, 29)),
    (date(2024, 2, 28), "weekly", 1, date(2024, 3, 6)),
])
def test_calendar_anchor(anchor, interval, index, expected):
    assert period_boundary(anchor, interval, index) == expected


def test_discount_allocation_and_tax_rounding():
    lines = [SimpleNamespace(unit_price=Decimal("0.05"), quantity=1, tax_rate=Decimal("10")) for _ in range(3)]
    totals = calculate(lines, Decimal("0.01"))
    assert totals.subtotal == Decimal("0.15")
    assert totals.tax == Decimal("0.02")
    assert totals.total == Decimal("0.16")
    assert sum(row["discount"] for row in totals.lines) == Decimal("0.01")


def test_full_discount_and_zero_price():
    lines = [SimpleNamespace(unit_price=Decimal("10"), quantity=1, tax_rate=Decimal("25"))]
    assert calculate(lines, Decimal("100")).total == Decimal("0.00")
    lines[0].unit_price = Decimal(0)
    assert calculate(lines).total == Decimal(0)


@pytest.mark.parametrize("change,reason", [
    ({"is_active": False}, "inactive"), ({"currency": "EUR"}, "currency_mismatch"),
    ({"starts_on": date(2026, 2, 1)}, "not_started"), ({"ends_on": date(2025, 12, 31)}, "expired"),
    ({"minimum_purchase": Decimal("101")}, "minimum_purchase"), ({"minimum_quantity": 3}, "minimum_quantity"),
    ({"usage_limit": 1, "used_count": 1}, "usage_limit"),
])
def test_discount_eligibility(change, reason):
    values = dict(is_active=True, currency="USD", kind="percentage", value=Decimal("10"),
        starts_on=None, ends_on=None, minimum_purchase=Decimal(0), minimum_quantity=1, usage_limit=None, used_count=0)
    rule = SimpleNamespace(**(values | change))
    amount, actual_reason = discount_amount(rule, Decimal("100"), 2, "USD", date(2026, 1, 1))
    assert amount == 0 and actual_reason == reason


@pytest.mark.parametrize("kind,value,subtotal,expected", [
    ("fixed", "5", "100", "5"), ("fixed", "500", "100", "100"),
    ("percentage", "12.3456", "99.99", "12.34"), ("percentage", "100", "0", "0"),
])
def test_discount_value_and_inclusive_dates(kind, value, subtotal, expected):
    on_date = date(2026, 1, 1)
    rule = SimpleNamespace(is_active=True, currency="USD", kind=kind, value=Decimal(value),
        starts_on=on_date, ends_on=on_date, minimum_purchase=Decimal(0), minimum_quantity=1, usage_limit=1, used_count=0)
    amount, reason = discount_amount(rule, Decimal(subtotal), 1, "USD", on_date)
    assert reason == "eligible" and amount == Decimal(expected)
