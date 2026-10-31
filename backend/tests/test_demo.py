import secrets
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select

from app.db.session import create_session_factory
from app.models import (User, CustomerProfile, Product, ProductVariant, SubscriptionPlan, Quotation,
    QuotationLine, QuotationTemplate, Subscription, SubscriptionLine, Invoice, InvoiceLine, Payment,
    TaxRate, DiscountRule, DiscountUsage)
from app.models.demo import DemoRun
from app.schemas.auth import RegisterRequest
from app.services.auth import bootstrap_admin
from app.services.demo import SEED_KEY, seed_demo
from app.services import payments

pytestmark = pytest.mark.db


def test_demo_atomicity_idempotency_and_amounts(db_engine, settings, monkeypatch):
    factory = create_session_factory(db_engine)
    marker = uuid4().hex
    accounts = {kind: {"email": f"demo-test-{marker}-{kind}@example.com", "password": "Aa!" + secrets.token_urlsafe(18)}
                for kind in ("admin", "staff", "customer1", "customer2", "customer3")}
    records = None
    with factory() as session:
        admin = bootstrap_admin(session, RegisterRequest(**accounts["admin"]))
    try:
        original = payments.record_payment
        def fail(*args, **kwargs):
            raise RuntimeError("Injected seed transaction failure")
        monkeypatch.setattr(payments, "record_payment", fail)
        with pytest.raises(RuntimeError):
            seed_demo(db_engine, settings, accounts)
        with factory() as session, session.begin():
            assert session.get(DemoRun, SEED_KEY) is None
            assert session.scalar(select(func.count()).select_from(User).where(User.email.in_([a["email"] for a in accounts.values()]))) == 1
            assert session.scalar(select(func.count()).select_from(Product).where(Product.name.like("DEMO %"))) == 0
        monkeypatch.setattr(payments, "record_payment", original)
        records, created = seed_demo(db_engine, settings, accounts)
        assert created is True
        repeated, created = seed_demo(db_engine, settings, accounts)
        assert created is False and records == repeated
        assert len(records["invoices"]) == 6 and len(records["users"]) == 5
        with factory() as session, session.begin():
            for invoice in session.scalars(select(Invoice).where(Invoice.id.in_([UUID(v) for v in records["invoices"]]))):
                paid = session.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.invoice_id == invoice.id))
                assert invoice.amount_paid == paid
                assert invoice.total == invoice.subtotal - invoice.discount + invoice.tax
                assert invoice.amount_paid <= invoice.total
    finally:
        with factory() as session, session.begin():
            if records:
                ids = {key: [UUID(value) for value in values] for key, values in records.items()}
                for model in (Payment, DiscountUsage, InvoiceLine):
                    session.execute(delete(model).where(model.invoice_id.in_(ids["invoices"])))
                for model, group in ((Invoice, "invoices"), (SubscriptionLine, "subscriptions"), (Subscription, "subscriptions"),
                    (QuotationLine, "quotations"), (Quotation, "quotations"), (QuotationTemplate, "templates"),
                    (SubscriptionPlan, "plans"), (ProductVariant, "variants"), (Product, "products"), (TaxRate, "tax_rates"), (DiscountRule, "discounts")):
                    column = model.subscription_id if model is SubscriptionLine else model.quotation_id if model is QuotationLine else model.id
                    session.execute(delete(model).where(column.in_(ids[group])))
                session.execute(delete(CustomerProfile).where(CustomerProfile.id.in_(ids["users"])))
                session.execute(delete(User).where(User.id.in_(ids["users"]), User.email.in_([a["email"] for a in accounts.values()])))
                session.execute(delete(DemoRun).where(DemoRun.key == SEED_KEY, DemoRun.records == records))
            else:
                session.execute(delete(User).where(User.id == admin.id, User.email == accounts["admin"]["email"]))
