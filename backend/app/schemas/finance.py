from datetime import date

from pydantic import BaseModel

from app.schemas.common import Amount, Currency


class DashboardResponse(BaseModel):
    currency: Currency
    active_subscriptions: int
    subscription_counts: dict[str, int]
    revenue_collected: Amount
    invoiced_total: Amount
    outstanding_balance: Amount
    overdue_invoice_count: int
    overdue_amount: Amount
    date_from: date | None
    date_to: date | None


class RevenuePoint(BaseModel):
    period: date
    collected: Amount


class RevenueReport(BaseModel):
    currency: Currency
    date_from: date
    date_to: date
    granularity: str
    items: list[RevenuePoint]
