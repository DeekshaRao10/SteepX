"""Check seeded relationships, totals, and live local API access without editing business records."""
import argparse
from collections import Counter, defaultdict
from decimal import Decimal
import json
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.core.config import BACKEND_DIR
from app.models import (CustomerProfile, DiscountRule, DiscountUsage, Invoice, Payment, Product,
                        ProductVariant, Quotation, QuotationTemplate, Subscription, SubscriptionPlan, TaxRate, User)
from app.models.demo import DemoRun
from app.services.common import today
from app.services.development_demo import SEED_KEY
from app.services.pricing import calculate, ZERO
from scripts.development_demo_credentials import load_credentials
from scripts.local_database import confirmed_engine

MODELS = {"users": User, "staff": User, "customers": CustomerProfile, "products": Product,
          "variants": ProductVariant, "plans": SubscriptionPlan, "tax_rates": TaxRate, "discounts": DiscountRule,
          "templates": QuotationTemplate, "quotations": Quotation, "subscriptions": Subscription, "invoices": Invoice, "payments": Payment}


class VerificationError(RuntimeError):
    pass


def check(condition, description):
    if not condition:
        raise VerificationError(description)


def inspect_database(engine):
    with Session(engine, autobegin=False) as session, session.begin():
        session.execute(text("SET TRANSACTION READ ONLY"))
        receipt = session.get(DemoRun, SEED_KEY)
        check(receipt is not None, "Development demo receipt is missing.")
        records = receipt.records
        ids = {group: [UUID(value) for value in values] for group, values in records.items()}
        for group, model in MODELS.items():
            present = set(session.scalars(select(model.id).where(model.id.in_(ids[group]))))
            check(present == set(ids[group]), f"Seeded {group} are missing; existing data was not changed.")
        quotes = session.scalars(select(Quotation).where(Quotation.id.in_(ids["quotations"])).options(selectinload(Quotation.lines))).all()
        subscriptions = session.scalars(select(Subscription).where(Subscription.id.in_(ids["subscriptions"])).options(selectinload(Subscription.lines))).all()
        invoices = session.scalars(select(Invoice).where(Invoice.id.in_(ids["invoices"])).options(selectinload(Invoice.lines))).all()
        payments = session.scalars(select(Payment).where(Payment.invoice_id.in_(ids["invoices"]))).all()
        plans = {plan.id: plan for plan in session.scalars(select(SubscriptionPlan).where(SubscriptionPlan.id.in_(ids["plans"])))}
        variants = {item.id: item for item in session.scalars(select(ProductVariant).where(ProductVariant.id.in_(ids["variants"])))}
        by_subscription = {item.id: item for item in subscriptions}
        paid = defaultdict(lambda: ZERO)
        for payment in payments:
            check(payment.amount > 0, "Payment amount must be positive.")
            paid[payment.invoice_id] += payment.amount
        for record in quotes + subscriptions + invoices:
            check(record.customer_id in ids["customers"], "Agreement has an unexpected customer.")
            check(record.currency == "USD", "Demo currency differs from USD.")
            for line in record.lines:
                check(line.plan_id in plans, "Agreement line references an unexpected plan.")
                for snapshot in line.selected_variants:
                    option = variants.get(UUID(snapshot["id"]))
                    check(option is not None and option.product_id == plans[line.plan_id].product_id, "Variant belongs to another product.")
        for record in quotes + invoices:
            amounts = calculate(record.lines, record.discount)
            check((record.subtotal, record.discount, record.tax, record.total) ==
                  (amounts.subtotal, amounts.discount, amounts.tax, amounts.total), "Document totals do not match billing calculations.")
        for invoice in invoices:
            check(invoice.customer_id == by_subscription[invoice.subscription_id].customer_id, "Invoice ownership differs from its subscription.")
            check(ZERO <= invoice.amount_paid <= invoice.total and paid[invoice.id] == invoice.amount_paid, "Payment ledger differs from invoice balance.")
            check(invoice.due_date >= invoice.issue_date and invoice.period_end > invoice.period_start, "Invoice dates are inconsistent.")
            for field in ("subtotal", "discount", "tax", "total"):
                check(sum((getattr(line, field) for line in invoice.lines), ZERO) == getattr(invoice, field), "Invoice line totals do not reconcile.")
        for subscription in subscriptions:
            check(subscription.quotation_id in ids["quotations"], "Subscription source quotation is missing.")
        for rule in session.scalars(select(DiscountRule).where(DiscountRule.id.in_(ids["discounts"]))):
            usage = session.scalars(select(DiscountUsage).where(DiscountUsage.discount_id == rule.id)).all()
            check(rule.used_count == len(usage), "Discount usage count does not reconcile.")
        def invoice_state(invoice):
            if invoice.status in {"draft", "paid"}:
                return invoice.status
            if invoice.due_date < today():
                return "overdue"
            return "partially_paid" if invoice.amount_paid > 0 else "unpaid"
        summary = {
            "counts": {key: len(values) for key, values in records.items()},
            "variant_kinds": dict(Counter(item.kind for item in variants.values())),
            "subscription_states": dict(Counter(item.state for item in subscriptions)),
            "quotation_states": dict(Counter(item.state for item in quotes)),
            "invoice_states": dict(Counter(invoice_state(item) for item in invoices)),
            "seed_revenue_collected": str(sum((item.amount for item in payments), ZERO)),
            "seed_outstanding_balance": str(sum((item.total - item.amount_paid for item in invoices if item.status != "draft"), ZERO)),
            "relationship_and_money_checks": "passed",
        }
        return records, summary


def verify_api(base_url, accounts, records):
    parsed = urlsplit(base_url)
    check(parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
          and parsed.username is None and parsed.password is None and not parsed.query and not parsed.fragment,
          "API verification is limited to a local HTTP server.")
    dashboard = None
    results = []
    with httpx.Client(base_url=base_url.rstrip("/") + "/", timeout=15, trust_env=False, follow_redirects=False) as client:
        def read(path, headers, **params):
            response = client.get(path, headers=headers, params=params)
            check(response.status_code == 200, f"API retrieval failed for {path}; response omitted.")
            return response.json()

        def listing(path, headers):
            items, offset = [], 0
            while True:
                page = read(path, headers, limit=100, offset=offset)
                items.extend(page["items"])
                offset += len(page["items"])
                if offset >= page["total"] or not page["items"]:
                    return items

        for alias in ("staff", "customer"):
            account = accounts[alias]
            check("password" in account, "This reused demo account requires its existing password for an interactive login check.")
            response = client.post("auth/login", json={"email": account["email"], "password": account["password"]})
            check(response.status_code == 200, f"{alias} login failed; credentials and response omitted.")
            headers = {"Authorization": "Bearer " + response.json()["access_token"]}
            try:
                profile = read("auth/me", headers)
                check(profile["role"] == account["role"], "Authenticated role differs from expected role.")
                if alias == "staff":
                    for group, path in (("products", "products"), ("plans", "plans"), ("customers", "customers"),
                                        ("tax_rates", "tax-rates"), ("discounts", "discounts"), ("templates", "quotation-templates"),
                                        ("quotations", "quotations"), ("subscriptions", "subscriptions"), ("invoices", "invoices"), ("payments", "payments")):
                        items = listing(path, headers)
                        check(set(records[group]).issubset({item["id"] for item in items}), f"The running API cannot retrieve seeded {group}; check its database target.")
                    dashboard = read("dashboard", headers, currency="USD")
                    check(dashboard["active_subscriptions"] >= 12 and Decimal(dashboard["revenue_collected"]) > 0
                          and Decimal(dashboard["outstanding_balance"]) > 0 and dashboard["overdue_invoice_count"] > 0,
                          "Finance dashboard does not contain the seeded activity.")
                    report = read("reports/revenue", headers, currency="USD")
                    check(len(report["items"]) >= 3, "Revenue history should cover several months.")
                    check(client.get("staff", headers=headers).status_code == 403, "Staff should not list the administration team.")
                else:
                    check(read("customers/me", headers)["id"] == profile["id"], "Customer profile ownership mismatch.")
                    for path in ("quotations", "subscriptions", "invoices"):
                        items = listing(path, headers)
                        check(items and all(item["customer_id"] == profile["id"] for item in items), "Customer data isolation failed.")
                    owned_invoices = {item["id"] for item in listing("invoices", headers)}
                    customer_payments = listing("payments", headers)
                    check(customer_payments and all(item["invoice_id"] in owned_invoices for item in customer_payments), "Customer payment isolation failed.")
                    other = next(identifier for identifier in records["customers"] if identifier != profile["id"])
                    check(client.get(f"customers/{other}", headers=headers).status_code == 404, "Another customer profile was exposed.")
                    check(client.get("dashboard", headers=headers).status_code == 403, "Customer should not access operator finance reports.")
                    check(client.get("products", headers=headers).status_code == 403, "Customer should not access internal product costs.")
                results.append(alias + ": login, API retrieval, role checks passed")
            finally:
                logout = client.post("auth/logout", headers=headers)
                check(logout.status_code == 204, "Verification session could not be revoked.")
            check(client.get("auth/me", headers=headers).status_code == 401, "Revoked session remained authenticated.")
    return {"api_checks": results, "dashboard": dashboard}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["development"])
    parser.add_argument("--api-url", default="http://127.0.0.1:8000/api/v1")
    args = parser.parse_args()
    engine = None
    try:
        engine = confirmed_engine()
        records, summary = inspect_database(engine)
        credentials = load_credentials(engine.url.database)
        summary.update(verify_api(args.api_url, credentials["accounts"], records))
        report = BACKEND_DIR / "tmp" / "development-demo-report.json"
        report.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary, indent=2))
        print("Verified confirmed development database and live local API; no business records changed.")
        return 0
    except VerificationError as error:
        print(str(error))
        return 1
    except Exception as error:
        print(f"Demo verification failed ({type(error).__name__}); sensitive details omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
