"""Real parallel PostgreSQL transactions; cleanup targets only this fixture's UUIDs."""

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select

from app.core.errors import PublicError
from app.db.session import create_session_factory
from app.models.billing import DiscountRule, DiscountUsage, Invoice, InvoiceLine, Payment
from app.models.catalog import CustomerProfile, Product, SubscriptionPlan
from app.models.commerce import Subscription, SubscriptionLine
from app.models.user import User, UserRole
from app.schemas.auth import UserResponse
from app.schemas.billing import InvoiceGenerate, PaymentCreate
from app.services.auth import AuthenticatedUser
from app.services.billing import confirm_invoice, generate_invoice
from app.services.common import today
from app.services.payments import record_payment

pytestmark = pytest.mark.db


@pytest.fixture
def committed_ledger(db_engine, password_hash):
    factory = create_session_factory(db_engine)
    user_id, product_id, plan_id, discount_id = (uuid4() for _ in range(4))
    subscription_ids = [uuid4(), uuid4()]
    with factory() as session, session.begin():
        user = User(id=user_id, email=f"concurrency-{user_id.hex}@example.com", password_hash=password_hash, role=UserRole.CUSTOMER)
        session.add(user)
        session.flush()
        session.add(CustomerProfile(id=user_id))
        session.add(Product(id=product_id, name=product_id.hex, type="software", sales_price=100, cost=0, currency="USD"))
        session.add(DiscountRule(id=discount_id, code=discount_id.hex.upper(), kind="percentage", value=10, currency="USD", usage_limit=1))
        session.flush()
        session.add(SubscriptionPlan(id=plan_id, product_id=product_id, name=plan_id.hex, price=100, billing_interval="monthly"))
        session.flush()
        for identifier in subscription_ids:
            session.add(Subscription(id=identifier, customer_id=user_id, state="active", currency="USD", billing_interval="monthly",
                end_behavior="renew", start_date=today(), next_billing_date=today(), lines=[SubscriptionLine(
                    position=0, plan_id=plan_id, description="Concurrent fixture", quantity=1, unit_price=100, tax_rate=0, selected_variants=[])]))
        session.flush()
        profile = UserResponse.model_validate(user).model_copy(update={"role": UserRole.STAFF})
    identity = AuthenticatedUser(profile, uuid4())
    try:
        yield factory, identity, subscription_ids, discount_id
    finally:
        with factory() as session, session.begin():
            invoices = select(Invoice.id).where(Invoice.subscription_id.in_(subscription_ids))
            for model in (Payment, DiscountUsage, InvoiceLine):
                session.execute(delete(model).where(model.invoice_id.in_(invoices)))
            session.execute(delete(Invoice).where(Invoice.subscription_id.in_(subscription_ids)))
            session.execute(delete(SubscriptionLine).where(SubscriptionLine.subscription_id.in_(subscription_ids)))
            session.execute(delete(Subscription).where(Subscription.id.in_(subscription_ids)))
            session.execute(delete(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
            session.execute(delete(Product).where(Product.id == product_id))
            session.execute(delete(DiscountRule).where(DiscountRule.id == discount_id))
            session.execute(delete(CustomerProfile).where(CustomerProfile.id == user_id))
            session.execute(delete(User).where(User.id == user_id, User.email == f"concurrency-{user_id.hex}@example.com"))


def parallel(first, second):
    barrier = Barrier(2)
    def run(operation):
        barrier.wait(timeout=10)
        try:
            return operation()
        except PublicError as error:
            return error.status_code
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run, operation) for operation in (first, second)]
        return [future.result(timeout=20) for future in futures]


def test_concurrent_invoice_period_is_generated_once(committed_ledger, settings):
    factory, identity, identifiers, _ = committed_ledger
    def generate():
        with factory() as session:
            return generate_invoice(session, identifiers[0], InvoiceGenerate(period_start=today()), identity, settings)
    first, second = parallel(generate, generate)
    assert first.id == second.id
    with factory() as session, session.begin():
        assert session.scalar(select(func.count()).select_from(Invoice).where(Invoice.subscription_id == identifiers[0])) == 1
        assert session.get(Subscription, identifiers[0]).next_period_index == 1


@pytest.mark.parametrize("same_key", [True, False])
def test_concurrent_payments_never_overpay(committed_ledger, settings, same_key):
    factory, identity, identifiers, _ = committed_ledger
    with factory() as session:
        invoice = generate_invoice(session, identifiers[0], InvoiceGenerate(period_start=today()), identity, settings)
        confirm_invoice(session, invoice.id, identity)
    key1, key2 = uuid4(), uuid4()
    data = PaymentCreate(invoice_id=invoice.id, amount="75.00", method="cash", payment_date=today())
    def pay(key):
        with factory() as session:
            return record_payment(session, data, key, identity)
    results = parallel(lambda: pay(key1), lambda: pay(key1 if same_key else key2))
    if same_key:
        assert results[0].id == results[1].id
    else:
        assert sum(result == 409 for result in results) == 1
    with factory() as session, session.begin():
        assert session.get(Invoice, invoice.id).amount_paid == Decimal("75.00")
        assert session.scalar(select(func.count()).select_from(Payment).where(Payment.invoice_id == invoice.id)) == 1


def test_global_discount_limit_under_concurrency(committed_ledger, settings):
    factory, identity, identifiers, discount_id = committed_ledger
    with factory() as session, session.begin():
        for identifier in identifiers:
            session.get(Subscription, identifier).discount_id = discount_id
    def generate(identifier):
        with factory() as session:
            return generate_invoice(session, identifier, InvoiceGenerate(period_start=today()), identity, settings)
    results = parallel(lambda: generate(identifiers[0]), lambda: generate(identifiers[1]))
    assert sorted(result.discount for result in results) == [Decimal("0.00"), Decimal("10.00")]
    with factory() as session, session.begin():
        assert session.get(DiscountRule, discount_id).used_count == 1
        assert session.scalar(select(func.count()).select_from(DiscountUsage).where(DiscountUsage.discount_id == discount_id)) == 1


def test_duplicate_payment_reference_rolls_back_balance(committed_ledger, settings):
    factory, identity, identifiers, _ = committed_ledger
    with factory() as session:
        invoice = generate_invoice(session, identifiers[0], InvoiceGenerate(period_start=today()), identity, settings)
        confirm_invoice(session, invoice.id, identity)
        data = PaymentCreate(invoice_id=invoice.id, amount="20", method="cash", payment_date=today(), reference="fixture-reference")
        record_payment(session, data, uuid4(), identity)
        with pytest.raises(PublicError):
            record_payment(session, data, uuid4(), identity)
        with session.begin():
            assert session.get(Invoice, invoice.id).amount_paid == Decimal("20.00")
