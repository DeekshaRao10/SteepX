"""Atomic, repeat-safe fake data for an explicitly verified local demo database."""
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.demo import DemoRun
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest, UserResponse
from app.schemas.billing import DiscountWrite, InvoiceGenerate, PaymentCreate, TaxWrite
from app.schemas.catalog import CustomerUpdate, PlanWrite, ProductWrite, VariantWrite
from app.schemas.commerce import LineSelection, QuotationWrite, TemplateWrite
from app.services import auth, billing, catalog, commerce, discounts, payments
from app.services.common import today

SEED_KEY = "steepx-demo-v1"


def seed_demo(engine, settings, accounts):
    # Caller must verify the isolated target. One outer transaction includes every
    # service savepoint and receipt: failures cannot leave half a demonstration.
    with engine.connect() as connection, connection.begin():
        with Session(bind=connection, autobegin=False, autoflush=False, expire_on_commit=False,
                     join_transaction_mode="create_savepoint") as session:
            with session.begin():
                session.execute(text("SELECT pg_advisory_xact_lock(731902211)"))
                admin = session.scalar(select(User).where(User.email == accounts["admin"]["email"]))
                if (admin is None or admin.role != UserRole.ADMIN or not admin.is_active
                        or not verify_password(accounts["admin"]["password"], admin.password_hash)):
                    raise RuntimeError("Use the separate demo admin bootstrap first.")
                identity = auth.AuthenticatedUser(UserResponse.model_validate(admin), uuid4())
                previous = session.get(DemoRun, SEED_KEY)
                if previous:
                    return previous.records, False
            records = {name: [] for name in ("users", "products", "variants", "plans", "tax_rates", "discounts",
                                               "templates", "quotations", "subscriptions", "invoices", "payments")}
            def keep(group, record):
                records[group].append(str(record.id))
                return record
            keep("users", identity.profile)
            staff = keep("users", auth.create_account(session, RegisterRequest(**accounts["staff"]), role=UserRole.STAFF))
            customers = []
            for index in range(1, 4):
                customer = keep("users", auth.create_account(session, RegisterRequest(**accounts[f"customer{index}"])))
                customers.append(customer)
                catalog.customer_profile(session, identity, customer.id, CustomerUpdate(
                    display_name=f"Demo Customer {index}", company=f"Example Studio {index}", billing_address="100 Fictional Avenue, Demo City"))
            tax = keep("tax_rates", discounts.write_tax(session, TaxWrite(name="DEMO illustration tax", rate="10.0000",
                description="Illustrative local demo rate, not a jurisdictional tax rule")))
            discount = keep("discounts", discounts.write_discount(session, DiscountWrite(code="DEMO10", kind="percentage", value="10", usage_limit=20)))
            keep("discounts", discounts.write_discount(session, DiscountWrite(code="DEMO5", kind="fixed", value="5", minimum_purchase="20")))
            product = keep("products", catalog.write_product(session, ProductWrite(name="DEMO Brightloop Workspace", type="software",
                sales_price="100", cost="20", notes="Fictional local reviewer data")))
            variant = keep("variants", catalog.write_variant(session, product.id, VariantWrite(name="DEMO Professional", kind="variant", additional_price="10")))
            addon = keep("variants", catalog.write_variant(session, product.id, VariantWrite(name="DEMO Priority support", kind="addon", additional_price="5")))
            plans = {}
            for interval, price in (("daily", "5"), ("weekly", "25"), ("monthly", "90"), ("yearly", "900")):
                plans[interval] = keep("plans", catalog.write_plan(session, PlanWrite(product_id=product.id,
                    name="DEMO " + interval.title(), price=price, billing_interval=interval, tax_rate_id=tax.id)))
            keep("templates", commerce.write_template(session, TemplateWrite(name="DEMO Team bundle", selections=[
                LineSelection(plan_id=plans["monthly"].id, quantity=2, variant_ids=[variant.id, addon.id])], validity_days=30)))
            for index, (interval, state, paid) in enumerate((
                ("monthly", "active", "full"), ("weekly", "active", "none"), ("daily", "active", "none"),
                ("yearly", "active", "partial"), ("monthly", "paused", "none"), ("monthly", "closed", "none"),
                ("monthly", "confirmed", "none"))):
                start = today() if interval == "daily" else today() - timedelta(days=60)
                quote = keep("quotations", commerce.write_quote(session, QuotationWrite(customer_id=customers[index % 3].id,
                    lines=[LineSelection(plan_id=plans[interval].id, variant_ids=[variant.id] if interval == "monthly" else [])],
                    start_date=start, discount_code=discount.code if index == 0 else None, notes="DEMO agreement"), identity))
                for action in ("issue", "confirm"):
                    commerce.quote_action(session, quote.id, identity, action)
                subscription = keep("subscriptions", commerce.create_subscription(session, quote.id, identity))
                if state == "confirmed":
                    continue
                commerce.subscription_action(session, subscription.id, identity, "activate")
                invoice = keep("invoices", billing.generate_invoice(session, subscription.id,
                    InvoiceGenerate(period_start=start, issue_date=start), identity, settings))
                billing.confirm_invoice(session, invoice.id, identity)
                if paid != "none":
                    amount = invoice.total if paid == "full" else (invoice.total / 2).quantize(Decimal("0.01"))
                    keep("payments", payments.record_payment(session, PaymentCreate(invoice_id=invoice.id, amount=amount,
                        method="bank_transfer", payment_date=today(), notes="DEMO manual payment; no gateway"), uuid4(), identity))
                if state in {"paused", "closed"}:
                    commerce.subscription_action(session, subscription.id, identity, "pause" if state == "paused" else "close")
            for index, state in enumerate(("draft", "quotation", "closed")):
                quote = keep("quotations", commerce.write_quote(session, QuotationWrite(customer_id=customers[index].id,
                    lines=[LineSelection(plan_id=plans["monthly"].id)], notes="DEMO " + state), identity))
                if state != "draft":
                    commerce.quote_action(session, quote.id, identity, "issue" if state == "quotation" else "close")
            with session.begin():
                session.add(DemoRun(key=SEED_KEY, records=records))
                session.flush()
            return records, True
