from datetime import timedelta

from sqlalchemy import and_, case, func, select

from app.core.errors import PublicError
from app.models.billing import Invoice, Payment
from app.models.commerce import Subscription
from app.schemas.finance import DashboardResponse, RevenuePoint, RevenueReport
from app.services.common import today
from app.services.pricing import ZERO


def validate_range(date_from, date_to):
    if date_from and date_to and date_to < date_from:
        raise PublicError(422, "validation_error", "The date range is reversed.")


def dashboard(session, currency, date_from=None, date_to=None, customer_id=None):
    validate_range(date_from, date_to)
    with session.begin():
        state = case((and_(Subscription.state.in_(["active", "paused"]), Subscription.term_end <= today()), "closed"), else_=Subscription.state)
        subs = select(state, func.count()).where(Subscription.currency == currency).group_by(state)
        invoices = select(Invoice).where(Invoice.currency == currency, Invoice.status.in_(["confirmed", "paid"]))
        payments = select(func.coalesce(func.sum(Payment.amount), 0)).join(Invoice).where(Invoice.currency == currency)
        if customer_id:
            subs = subs.where(Subscription.customer_id == customer_id)
            invoices = invoices.where(Invoice.customer_id == customer_id)
            payments = payments.where(Invoice.customer_id == customer_id)
        if date_from: payments = payments.where(Payment.payment_date >= date_from)
        if date_to: payments = payments.where(Payment.payment_date <= date_to)
        counts = {name: 0 for name in ("confirmed", "active", "paused", "closed")}
        counts.update(dict(session.execute(subs).all()))
        ledger = invoices.subquery()
        outstanding = ledger.c.total - ledger.c.amount_paid
        overdue = and_(ledger.c.due_date < today(), outstanding > 0)
        in_range = and_(ledger.c.issue_date >= date_from if date_from else True,
                        ledger.c.issue_date <= date_to if date_to else True)
        totals = session.execute(select(
            func.coalesce(func.sum(case((in_range, ledger.c.total), else_=0)), 0),
            func.coalesce(func.sum(outstanding), 0),
            func.count().filter(overdue),
            func.coalesce(func.sum(case((overdue, outstanding), else_=0)), 0),
        )).one()
        return DashboardResponse(currency=currency, active_subscriptions=counts["active"], subscription_counts=counts,
            revenue_collected=session.scalar(payments), invoiced_total=totals[0], outstanding_balance=totals[1],
            overdue_invoice_count=totals[2], overdue_amount=totals[3], date_from=date_from, date_to=date_to)


def revenue_report(session, currency, date_from=None, date_to=None, granularity="month", customer_id=None):
    date_to = date_to or today()
    date_from = date_from or date_to - timedelta(days=365)
    validate_range(date_from, date_to)
    if (date_to - date_from).days > 3660:
        raise PublicError(422, "validation_error", "Report ranges are limited to ten years.")
    with session.begin():
        bucket = func.date_trunc(granularity, Payment.payment_date)
        statement = select(bucket, func.sum(Payment.amount)).join(Invoice).where(
            Invoice.currency == currency, Payment.payment_date >= date_from, Payment.payment_date <= date_to)
        if customer_id: statement = statement.where(Invoice.customer_id == customer_id)
        rows = session.execute(statement.group_by(bucket).order_by(bucket)).all()
        return RevenueReport(currency=currency, date_from=date_from, date_to=date_to, granularity=granularity,
                             items=[RevenuePoint(period=row[0].date(), collected=row[1]) for row in rows])
