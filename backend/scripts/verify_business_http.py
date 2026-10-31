"""Real HTTP workflow on the marked demo target; preserves demo records."""
import argparse
import json
import os
import secrets
import socket
import subprocess
import sys
import time
from uuid import UUID, uuid4

import httpx
from sqlalchemy import delete, func, select

from app.core.config import BACKEND_DIR, Settings
from app.core.security import decode_access_token
from app.db.session import create_session_factory
from app.models import (AuthSession, User, CustomerProfile, Product, ProductVariant, SubscriptionPlan, Quotation,
    QuotationLine, Subscription, SubscriptionLine, Invoice, InvoiceLine, Payment, TaxRate, DiscountRule, DiscountUsage)
from app.models.demo import DemoRun
from app.services.common import today
from app.services.demo import SEED_KEY
from scripts.demo_credentials import prepare_credentials
from scripts.local_database import confirmed_engine, demo_database_name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["isolated-demo"])
    parser.parse_args()
    engine = confirmed_engine(demo_name=demo_database_name())
    factory = create_session_factory(engine)
    accounts = prepare_credentials(demo_database_name())["accounts"]
    marker = uuid4().hex
    password = "Aa!" + secrets.token_urlsafe(24)
    signing_key = secrets.token_urlsafe(48)
    settings = Settings(jwt_secret_key=signing_key)
    protected = [password, signing_key] + [account["password"] for account in accounts.values()]
    identifiers = {key: [] for key in ("users", "sessions", "products", "variants", "plans", "tax_rates", "discounts", "quotations", "subscriptions", "invoices")}
    checks = 0
    process = None

    def expect(response, status):
        nonlocal checks
        if response.status_code != status:
            raise RuntimeError(f"Unexpected status for HTTP check {checks + 1}; response omitted.")
        checks += 1
        return response.json() if status != 204 else None

    def keep(group, response):
        identifiers[group].append(UUID(response["id"]))
        return response

    def headers(client, credentials):
        response = expect(client.post("/api/v1/auth/login", json=credentials), 200)
        token = response["access_token"]
        protected.append(token)
        identifiers["sessions"].append(decode_access_token(token, settings).session_id)
        return {"Authorization": "Bearer " + token}

    try:
        with factory() as session, session.begin():
            receipt = session.get(DemoRun, SEED_KEY)
            if not receipt:
                raise RuntimeError("Run the explicit demo seed first.")
            demo_records = receipt.records
            for model, group in ((User, "users"), (Product, "products"), (SubscriptionPlan, "plans"),
                (Quotation, "quotations"), (Subscription, "subscriptions"), (Invoice, "invoices"), (Payment, "payments")):
                count = session.scalar(select(func.count()).select_from(model).where(model.id.in_([UUID(v) for v in demo_records[group]])))
                if count != len(demo_records[group]):
                    raise RuntimeError("Demo receipt does not match stored records.")
            for invoice in session.scalars(select(Invoice).where(Invoice.id.in_([UUID(v) for v in demo_records["invoices"]]))):
                paid = session.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.invoice_id == invoice.id))
                if paid != invoice.amount_paid or invoice.total != invoice.subtotal - invoice.discount + invoice.tax:
                    raise RuntimeError("Demo invoice consistency check failed.")
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        environment = dict(os.environ)
        environment.update(DATABASE_URL=engine.url.render_as_string(hide_password=False), JWT_SECRET_KEY=signing_key, JWT_ALGORITHM="HS256")
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1",
            "--port", str(port), "--no-access-log"], cwd=BACKEND_DIR, env=environment, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=15, trust_env=False) as client:
            ready = False
            for _ in range(100):
                if process.poll() is not None: break
                try:
                    response = client.get("/api/v1/health")
                    if response.status_code == 200:
                        ready = True
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.1)
            if not ready: raise RuntimeError("Verification server did not become ready.")
            assert expect(response, 200) == {"status": "ok", "service": "Brightloop Subscription API"}
            schema = expect(client.get("/openapi.json"), 200)
            assert "/api/v1/payments" in schema["paths"]
            admin = headers(client, accounts["admin"])
            staff = headers(client, accounts["staff"])
            other = headers(client, accounts["customer2"])
            credentials = {"email": f"http-business-{marker}@example.com", "password": password}
            customer = keep("users", expect(client.post("/api/v1/auth/register", json=credentials), 201))
            own = headers(client, credentials)
            expect(client.patch("/api/v1/customers/me", headers=own, json={"display_name": "HTTP Fixture"}), 200)
            expect(client.patch("/api/v1/customers/me", headers=own, json={"is_active": True}), 422)
            expect(client.get(f"/api/v1/customers/{customer['id']}", headers=other), 404)
            expect(client.get("/api/v1/products"), 401)
            expect(client.get("/api/v1/products", headers=own), 403)
            product = keep("products", expect(client.post("/api/v1/products", headers=staff, json={"name": marker,
                "type": "software", "sales_price": "100", "cost": "10"}), 201))
            variant = keep("variants", expect(client.post(f"/api/v1/products/{product['id']}/variants", headers=staff,
                json={"name": "HTTP add-on", "kind": "addon", "additional_price": "10"}), 201))
            expect(client.post("/api/v1/tax-rates", headers=staff, json={"name": marker, "rate": "10"}), 403)
            tax = keep("tax_rates", expect(client.post("/api/v1/tax-rates", headers=admin, json={"name": marker, "rate": "10"}), 201))
            discount = keep("discounts", expect(client.post("/api/v1/discounts", headers=admin,
                json={"code": "H" + marker.upper(), "kind": "percentage", "value": "10"}), 201))
            plan = keep("plans", expect(client.post("/api/v1/plans", headers=staff, json={"name": marker, "product_id": product["id"],
                "tax_rate_id": tax["id"], "price": "100", "billing_interval": "monthly"}), 201))
            expect(client.get("/api/v1/plans", headers=own, params={"q": marker, "billing_interval": "monthly"}), 200)
            body = {"lines": [{"plan_id": plan["id"], "quantity": 2, "variant_ids": [variant["id"]]}], "discount_code": discount["code"]}
            expect(client.post("/api/v1/quotations", headers=own, json=body | {"customer_id": customer["id"]}), 403)
            quote = keep("quotations", expect(client.post("/api/v1/quotations", headers=own, json=body), 201))
            assert quote["total"] == "217.80"
            path = f"/api/v1/quotations/{quote['id']}"
            expect(client.get(path, headers=other), 404)
            expect(client.post(path + "/actions/confirm", headers=own), 409)
            for action in ("issue", "confirm"):
                expect(client.post(path + "/actions/" + action, headers=own), 200)
            expect(client.put(path, headers=own, json=body), 409)
            subscription = keep("subscriptions", expect(client.post("/api/v1/subscriptions", headers=own, json={"quotation_id": quote["id"]}), 201))
            path = f"/api/v1/subscriptions/{subscription['id']}"
            expect(client.get(path, headers=other), 404)
            for action in ("activate", "pause", "resume"):
                expect(client.post(path + "/actions/" + action, headers=own), 200)
            period = {"period_start": today().isoformat()}
            expect(client.post(path + "/invoices", headers=own, json=period), 403)
            invoice = keep("invoices", expect(client.post(path + "/invoices", headers=staff, json=period), 201))
            assert invoice["total"] == "217.80"
            assert expect(client.post(path + "/invoices", headers=staff, json=period), 201)["id"] == invoice["id"]
            expect(client.get(f"/api/v1/invoices/{invoice['id']}", headers=other), 404)
            expect(client.post(f"/api/v1/invoices/{invoice['id']}/confirm", headers=staff), 200)
            payment_body = {"invoice_id": invoice["id"], "amount": "50", "method": "cash", "payment_date": today().isoformat()}
            payment_headers = staff | {"Idempotency-Key": str(uuid4())}
            expect(client.post("/api/v1/payments", headers=own | {"Idempotency-Key": str(uuid4())}, json=payment_body), 403)
            payment = expect(client.post("/api/v1/payments", headers=payment_headers, json=payment_body), 201)
            assert expect(client.post("/api/v1/payments", headers=payment_headers, json=payment_body), 201)["id"] == payment["id"]
            expect(client.post("/api/v1/payments", headers=staff | {"Idempotency-Key": str(uuid4())}, json=payment_body | {"amount": "500"}), 409)
            expect(client.get(f"/api/v1/payments/{payment['id']}", headers=other), 404)
            assert expect(client.get("/api/v1/dashboard", headers=staff, params={"customer_id": customer["id"]}), 200)["revenue_collected"] == "50.00"
            expect(client.get("/api/v1/dashboard", headers=own), 403)
            expect(client.get("/api/v1/reports/revenue", headers=staff), 200)
            expect(client.post("/api/v1/payments", headers=staff | {"Idempotency-Key": str(uuid4())}, json=payment_body | {"amount": "167.80"}), 201)
            assert expect(client.get(f"/api/v1/invoices/{invoice['id']}", headers=own), 200)["status"] == "paid"
            expect(client.post(path + "/actions/close", headers=own), 200)
            keep("subscriptions", expect(client.post(path + "/renew", headers=own, json={}), 201))
            expect(client.post("/api/v1/auth/logout", headers=own), 204)
            expect(client.get("/api/v1/auth/me", headers=own), 401)
        print(f"Live business HTTP verification: {checks} checks passed. Demo relationships and balances checked. No responses or credentials displayed.")
        return 0
    except Exception as error:
        print(f"Business HTTP verification failed ({type(error).__name__}) after {checks} successful checks; response details omitted.")
        return 1
    finally:
        leaked = False
        if process:
            process.terminate()
            try:
                output = process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                output = process.communicate()
            combined = b"".join(output).decode("utf-8", errors="replace")
            if any(value in combined for value in protected):
                leaked = True
                print("ERROR: Sensitive logging detected; values suppressed.")
            else:
                print("Server log scan: generated credentials and access tokens absent.")
        with factory() as session, session.begin():
            session.execute(delete(AuthSession).where(AuthSession.id.in_(identifiers["sessions"])))
            for model in (Payment, DiscountUsage, InvoiceLine):
                session.execute(delete(model).where(model.invoice_id.in_(identifiers["invoices"])))
            session.execute(delete(Invoice).where(Invoice.id.in_(identifiers["invoices"])))
            session.execute(delete(SubscriptionLine).where(SubscriptionLine.subscription_id.in_(identifiers["subscriptions"])))
            for identifier in reversed(identifiers["subscriptions"]):
                session.execute(delete(Subscription).where(Subscription.id == identifier))
            session.execute(delete(QuotationLine).where(QuotationLine.quotation_id.in_(identifiers["quotations"])))
            for model, group in ((Quotation, "quotations"), (SubscriptionPlan, "plans"), (ProductVariant, "variants"),
                (Product, "products"), (DiscountRule, "discounts"), (TaxRate, "tax_rates"), (CustomerProfile, "users"), (User, "users")):
                session.execute(delete(model).where(model.id.in_(identifiers[group])))
        engine.dispose()
        print("Only this HTTP run's identified records/sessions removed; demo data retained. Verification process stopped.")
        if leaked:
            raise RuntimeError("Sensitive logging detected; values suppressed.")


if __name__ == "__main__":
    raise SystemExit(main())
