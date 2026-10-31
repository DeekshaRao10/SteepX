"""Additive development dataset using the application's existing business services.

Only the explicit scripts.seed_demo --target development entry point calls this.
Its caller must verify the development database before supplying an engine.
"""
from datetime import timedelta
from decimal import Decimal
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.demo import DemoRun
from app.models.user import User, UserRole
from app.models.catalog import CustomerProfile
from app.schemas.auth import RegisterRequest, UserResponse
from app.schemas.billing import DiscountWrite, InvoiceGenerate, PaymentCreate, TaxWrite
from app.schemas.catalog import PlanWrite, ProductWrite, VariantWrite
from app.schemas.commerce import LineSelection, QuotationWrite, TemplateWrite
from app.services import auth, billing, catalog, commerce, discounts, payments
from app.services.common import today

SEED_KEY = "steepx-development-demo-v1"
ACCOUNT_SPECS = {
    "staff": {"email": "staff.demo@example.com", "role": "staff"},
    "staff_billing": {"email": "staff.billing.demo@example.com", "role": "staff"},
    "customer": {"email": "customer.demo@example.com", "role": "customer", "display_name": "Maya Patel", "company": "Cedar & Finch Studio", "phone": "+1 415 555 0101", "billing_address": "120 Market Street\nSan Francisco, CA 94103\nUnited States"},
    "customer_northstar": {"email": "customer.northstar.demo@example.com", "role": "customer", "display_name": "Daniel Brooks", "company": "Northstar Analytics", "phone": "+1 212 555 0102", "billing_address": "42 Madison Avenue\nNew York, NY 10010\nUnited States"},
    "customer_harbor": {"email": "customer.harbor.demo@example.com", "role": "customer", "display_name": "Sofia Rivera", "company": "Harbor Commerce", "phone": "+1 305 555 0103", "billing_address": "85 Bayside Drive\nMiami, FL 33132\nUnited States"},
    "customer_orbit": {"email": "customer.orbit.demo@example.com", "role": "customer", "display_name": "Ethan Chen", "company": "Orbit Logistics", "phone": "+1 206 555 0104", "billing_address": "300 Pine Street\nSeattle, WA 98101\nUnited States"},
    "customer_lumen": {"email": "customer.lumen.demo@example.com", "role": "customer", "display_name": "Priya Nair", "company": "Lumen Health", "phone": "+1 512 555 0105", "billing_address": "75 Congress Avenue\nAustin, TX 78701\nUnited States"},
    "customer_summit": {"email": "customer.summit.demo@example.com", "role": "customer", "display_name": "Noah Williams", "company": "Summit Education", "phone": "+1 303 555 0106", "billing_address": "210 Learning Way\nDenver, CO 80202\nUnited States"},
}

# name, category, monthly price, cost, minimum units, tax index, features, option labels
PRODUCTS = [
    ("Workspace Collaboration", "software", "24", "7", 5, 0, "Shared projects and team calendars\nDocument collaboration\nRole-based workspaces", ("Business Edition", "Enterprise Edition", "Extra Storage", "Guest Collaboration")),
    ("Insights Analytics", "software", "89", "24", 1, 0, "Interactive dashboards\nScheduled exports\nData source connectors", ("Advanced Analytics", "Enterprise Analytics", "Warehouse Connector", "Daily Report Delivery")),
    ("Secure Backup", "software", "45", "12", 2, 1, "Encrypted daily backups\n30-day retention\nSelf-service restoration", ("90-Day Retention", "365-Day Retention", "Regional Replica", "Restore Assistance")),
    ("Service Desk", "software", "59", "16", 2, 0, "Shared support inbox\nTicket automation\nCustomer knowledge base", ("Omnichannel Edition", "Enterprise Service Desk", "Chat Channel", "SLA Reporting")),
    ("Workflow Automation", "software", "79", "18", 1, 0, "Approval workflows\nScheduled jobs\nAudit history", ("Advanced Workflows", "Enterprise Workflows", "Extra Job Capacity", "Audit Export")),
    ("API Gateway", "usage", "120", "30", 1, 2, "Monthly API capacity allocation\nRate controls\nUsage dashboards", ("High Throughput", "Dedicated Capacity", "Additional Request Pack", "Extended Log Retention")),
    ("Managed Onboarding", "service", "240", "95", 1, 3, "Implementation workshops\nConfiguration assistance\nTeam training", ("Team Onboarding", "Enterprise Rollout", "Extra Training Session", "Data Migration Assistance")),
    ("Priority Support", "service", "160", "60", 1, 3, "Priority response queue\nService reviews\nNamed support contact", ("Extended Hours", "Round-the-Clock Support", "Monthly Health Review", "Incident Readiness Session")),
    ("Commerce Connect", "software", "99", "27", 1, 0, "Storefront integrations\nCatalog synchronization\nOrder reporting", ("Multi-Store Edition", "Enterprise Commerce", "Additional Storefront", "Inventory Connector")),
]

# Product, cadence, eventual state, days before today, settlement per billing period.
SCENARIOS = [
    (0, "monthly", "active", 125, ("paid", "paid", "paid", "partial")),
    (1, "monthly", "active", 75, ("paid", "overdue", "unpaid")),
    (2, "weekly", "active", 28, ("paid", "paid", "partial", "unpaid")),
    (3, "yearly", "active", 60, ("paid",)),
    (4, "monthly", "active", 45, ("overdue", "partial")),
    (5, "monthly", "active", 10, ("unpaid",)),
    (6, "weekly", "active", 21, ("paid", "overdue", "unpaid")),
    (7, "monthly", "active", 8, ("draft",)),
    (8, "yearly", "active", 90, ("paid",)),
    (0, "monthly", "active", 95, ("paid", "paid", "overdue")),
    (1, "weekly", "active", 14, ("partial", "unpaid")),
    (4, "yearly", "active", 5, ("partial",)),
    (2, "monthly", "paused", 50, ("paid", "unpaid")),
    (3, "weekly", "paused", 21, ("paid", "partial")),
    (8, "monthly", "paused", 75, ("overdue", "unpaid")),
    (7, "monthly", "closed", 70, ("paid", "paid")),
    (6, "weekly", "closed", 21, ("paid", "overdue")),
    (5, "monthly", "confirmed", 0, ()),
]


class DemoSeedError(RuntimeError):
    """Messages in this exception contain only deliberately safe explanations."""


def select_existing_admin(session):
    admins = session.scalars(select(User).where(User.role == UserRole.ADMIN).order_by(User.created_at, User.id)).all()
    active = [user for user in admins if user.is_active]
    if not active:
        raise DemoSeedError("No active administrator exists. Run the documented first-admin bootstrap separately; no accounts were promoted.")
    return next((user for user in active if user.email == "admin.demo@example.com"), active[0])


def seed_development_demo(engine, settings, accounts):
    anchor = today()
    with engine.connect() as connection, connection.begin():
        # Take the lock in the outer transaction, including all service savepoints.
        connection.execute(text("SELECT pg_advisory_xact_lock(731902212)"))
        with Session(bind=connection, autobegin=False, autoflush=False, expire_on_commit=False,
                     join_transaction_mode="create_savepoint") as session:
            with session.begin():
                previous = session.get(DemoRun, SEED_KEY)
                if previous:
                    return previous.records, {"created": {}, "reused": {group: len(ids) for group, ids in previous.records.items()}}
                admin = select_existing_admin(session)
                if admin.email != accounts["admin"]["email"]:
                    raise DemoSeedError("Administrator changed since target inspection; no records were seeded.")
                identity = auth.AuthenticatedUser(UserResponse.model_validate(admin), uuid4())
            groups = ("users", "staff", "customers", "products", "variants", "plans", "tax_rates", "discounts", "templates", "quotations", "subscriptions", "invoices", "payments")
            records = {group: [] for group in groups}
            changes = {kind: {group: 0 for group in groups} for kind in ("created", "reused")}

            def keep(group, record, created=True):
                records[group].append(str(record.id))
                changes["created" if created else "reused"][group] += 1
                return record

            keep("users", identity.profile, False)
            customers, staff = [], []
            for alias, spec in ACCOUNT_SPECS.items():
                credentials = accounts[alias]
                with session.begin():
                    existing = session.scalar(select(User).where(User.email == spec["email"]))
                    if existing:
                        if existing.role.value != spec["role"] or not existing.is_active:
                            raise DemoSeedError("A reserved demo email belongs to an inactive account or another role; no account was changed.")
                        if existing.role == UserRole.CUSTOMER:
                            profile = session.get(CustomerProfile, existing.id)
                            if profile is None or not profile.is_active:
                                raise DemoSeedError("An existing demo customer lacks an active billing profile; no account was changed.")
                        user = UserResponse.model_validate(existing)
                created = existing is None
                if created:
                    if not credentials.get("password"):
                        raise DemoSeedError("New demo account lacks a private generated password; no records were seeded.")
                    data = RegisterRequest(**{key: value for key, value in spec.items() if key != "role"}, password=credentials["password"])
                    user = auth.create_account(session, data, role=UserRole(spec["role"]))
                keep("users", user, created)
                if user.role == UserRole.CUSTOMER:
                    customers.append(keep("customers", user, created))
                else:
                    staff.append(keep("staff", user, created))

            taxes = [keep("tax_rates", discounts.write_tax(session, TaxWrite(name="DEMO " + name, rate=rate,
                description="Illustrative demo rate for local exploration, not a jurisdictional tax rule.")))
                for name, rate in (("Standard Sales Tax", "10"), ("Reduced Tax", "5"), ("Zero Rate", "0"), ("Services Tax", "8.25"))]
            discount_specs = [
                dict(code="BLDEMO10", kind="percentage", value="10", minimum_purchase="50"),
                dict(code="BLDEMO25", kind="fixed", value="25", minimum_purchase="250"),
                dict(code="BLDEMOTEAM15", kind="percentage", value="15", minimum_purchase="100", minimum_quantity=5),
                dict(code="BLDEMOANNUAL100", kind="fixed", value="100", minimum_purchase="800"),
                dict(code="BLDEMO5", kind="percentage", value="5"),
            ]
            for spec in discount_specs:
                keep("discounts", discounts.write_discount(session, DiscountWrite(**spec, currency="USD", starts_on=anchor - timedelta(days=730),
                    ends_on=anchor + timedelta(days=365), usage_limit=500)))
            products, options, plans = [], {}, {}
            for index, (name, category, price, cost, minimum, tax_index, features, labels) in enumerate(PRODUCTS):
                product = keep("products", catalog.write_product(session, ProductWrite(name="DEMO " + name, type=category,
                    sales_price=price, cost=cost, currency="USD", notes=features + "\nFictional local demonstration catalog.", is_active=True)))
                products.append(product)
                options[index] = []
                for option_index, (label, multiplier) in enumerate(zip(labels, ("0.2", "0.5", "0.1", "0.15"))):
                    options[index].append(keep("variants", catalog.write_variant(session, product.id, VariantWrite(name=label,
                        kind="variant" if option_index < 2 else "addon", additional_price=(Decimal(price) * Decimal(multiplier)).quantize(Decimal("0.01"))))))
                for interval, multiplier in (("weekly", "0.30"), ("monthly", "1"), ("yearly", "10")):
                    plans[index, interval] = keep("plans", catalog.write_plan(session, PlanWrite(product_id=product.id,
                        name=f"DEMO {name} {interval.title()}", price=(Decimal(price) * Decimal(multiplier)).quantize(Decimal("0.01")),
                        billing_interval=interval, minimum_quantity=minimum, available_from=anchor - timedelta(days=730),
                        available_until=anchor + timedelta(days=730), tax_rate_id=taxes[tax_index].id,
                        description=features, end_behavior="renew", is_active=True)))

            bundles = [("Collaboration Starter", [(0, "monthly", 5), (2, "monthly", 2)]),
                       ("Analytics & Automation", [(1, "monthly", 2), (4, "monthly", 2)]),
                       ("Commerce Launch", [(8, "monthly", 1), (7, "monthly", 1)]),
                       ("Weekly Operations", [(3, "weekly", 2), (6, "weekly", 1)]),
                       ("Annual Enterprise", [(1, "yearly", 3), (8, "yearly", 2)])]
            for name, selections in bundles:
                keep("templates", commerce.write_template(session, TemplateWrite(name="DEMO " + name, validity_days=30,
                    notes="Reusable demo proposal with current catalog prices.", selections=[LineSelection(plan_id=plans[index, interval].id,
                    quantity=quantity, variant_ids=[options[index][2].id]) for index, interval, quantity in selections])))

            for index, (product_index, interval, final_state, days_back, modes) in enumerate(SCENARIOS):
                customer = customers[index % len(customers)]
                operator = auth.AuthenticatedUser(staff[index % len(staff)], uuid4())
                plan = plans[product_index, interval]
                selected = [options[product_index][2]]
                if index % 2 == 0:
                    selected.append(options[product_index][0])
                quantity = max(plan.minimum_quantity, 2 if interval == "yearly" else 1)
                if index % 6 == 0:
                    quantity = max(quantity, 5)
                subtotal = (plan.price + sum((item.additional_price for item in selected), Decimal(0))) * quantity
                code = "BLDEMO5"
                if interval == "yearly" and subtotal >= 800:
                    code = "BLDEMOANNUAL100"
                elif index % 6 == 0 and subtotal >= 100:
                    code = "BLDEMOTEAM15"
                elif subtotal >= 250:
                    code = "BLDEMO25"
                elif subtotal >= 50:
                    code = "BLDEMO10"
                start = anchor - timedelta(days=days_back)
                quote = keep("quotations", commerce.write_quote(session, QuotationWrite(customer_id=customer.id,
                    lines=[LineSelection(plan_id=plan.id, quantity=quantity, variant_ids=[item.id for item in selected])],
                    start_date=start, valid_until=anchor + timedelta(days=30), discount_code=code,
                    notes=f"DEMO agreement {index + 1:02d}: {ACCOUNT_SPECS[list(ACCOUNT_SPECS)[2 + index % len(customers)]]['company']}; fictional service contract."), identity))
                for action in ("issue", "confirm"):
                    commerce.quote_action(session, quote.id, identity, action)
                subscription = keep("subscriptions", commerce.create_subscription(session, quote.id, identity))
                if final_state == "confirmed":
                    continue
                subscription = commerce.subscription_action(session, subscription.id, identity, "activate")
                for period_index, mode in enumerate(modes):
                    period_start = subscription.next_billing_date
                    issue = max(period_start, anchor - timedelta(days=3)) if mode in {"partial", "unpaid", "draft"} else period_start
                    due = issue + timedelta(days=7 if mode == "overdue" else 14)
                    if mode == "overdue" and due >= anchor:
                        raise DemoSeedError("Demo overdue schedule is invalid; nothing was committed.")
                    invoice = keep("invoices", billing.generate_invoice(session, subscription.id, InvoiceGenerate(
                        period_start=period_start, issue_date=issue, due_date=due), operator, settings))
                    if mode != "draft":
                        billing.confirm_invoice(session, invoice.id, operator)
                    if mode in {"paid", "partial"}:
                        first = (invoice.total * Decimal("0.40")).quantize(Decimal("0.01"))
                        amounts = [first] if mode == "partial" else ([first, invoice.total - first] if index % 2 == 0 else [invoice.total])
                        for installment, amount in enumerate(amounts):
                            reference = f"BL-DEMO-{index + 1:02d}-{period_index + 1:02d}-{installment + 1}"
                            paid_on = min(anchor, issue + timedelta(days=2 + installment * 3))
                            keep("payments", payments.record_payment(session, PaymentCreate(invoice_id=invoice.id, amount=amount,
                                method=("bank_transfer", "check", "cash", "other")[(index + installment) % 4], payment_date=paid_on,
                                reference=reference, notes="Fictional local demo settlement; no payment gateway was contacted."),
                                uuid5(NAMESPACE_URL, SEED_KEY + "/" + reference), operator))
                    subscription = commerce.subscription_detail(session, subscription.id, identity)
                if final_state in {"paused", "closed"}:
                    commerce.subscription_action(session, subscription.id, identity, "pause" if final_state == "paused" else "close")

            for index, state in enumerate(("draft", "draft", "quotation", "quotation", "confirmed", "confirmed", "confirmed", "closed")):
                plan = plans[index % len(products), "monthly"]
                quote = keep("quotations", commerce.write_quote(session, QuotationWrite(customer_id=customers[index % len(customers)].id,
                    lines=[LineSelection(plan_id=plan.id, quantity=plan.minimum_quantity)], start_date=anchor,
                    valid_until=anchor + timedelta(days=15 + index), notes=f"DEMO pipeline proposal {index + 1:02d}; review through the UI."), identity))
                if state in {"quotation", "confirmed"}:
                    commerce.quote_action(session, quote.id, identity, "issue")
                if state == "confirmed":
                    commerce.quote_action(session, quote.id, identity, "confirm")
                if state == "closed":
                    commerce.quote_action(session, quote.id, identity, "close")
            with session.begin():
                session.add(DemoRun(key=SEED_KEY, records=records))
                session.flush()
            return records, changes
