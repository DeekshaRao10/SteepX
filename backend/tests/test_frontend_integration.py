"""Browser-facing workflows against the marked test DB; fixtures roll back all records."""
from uuid import uuid4

import pytest

from app.models.user import UserRole
from app.services.common import today

pytestmark = pytest.mark.db


def successful(response, expected=200):
    assert response.status_code == expected
    return response.json()


def test_registration_profile_sessions_and_staff_permissions(client, password, make_user, login_headers):
    email = f"frontend-{uuid4().hex}@example.com"
    account = successful(client.post("/api/v1/auth/register", json={
        "email": email, "password": password, "display_name": "Integration Customer",
        "company": "Example Company", "phone": "123456", "billing_address": "10 Example Street",
    }), 201)
    assert account["role"] == "customer"
    token = successful(client.post("/api/v1/auth/login", json={"email": email, "password": password}))
    headers = {"Authorization": "Bearer " + token["access_token"]}
    profile = successful(client.get("/api/v1/customers/me", headers=headers))
    assert profile["id"] == account["id"] and profile["email"] == email
    assert profile["display_name"] == "Integration Customer"
    assert profile["company"] == "Example Company"
    updated = successful(client.patch("/api/v1/customers/me", headers=headers, json={"display_name": "Updated"}))
    assert updated["display_name"] == "Updated"
    assert client.get("/api/v1/staff", headers=headers).status_code == 403
    assert client.post("/api/v1/customers/accounts", headers=headers, json={"email": email, "password": password}).status_code == 403
    assert client.patch("/api/v1/customers/me", headers=headers, json={"is_active": False}).status_code == 422
    assert client.post("/api/v1/auth/register", json={"email": email, "password": password, "role": "admin"}).status_code == 422

    admin = login_headers(make_user(UserRole.ADMIN))
    staff_email = f"staff-{uuid4().hex}@example.com"
    staff = successful(client.post("/api/v1/staff", headers=admin, json={"email": staff_email, "password": password}), 201)
    assert staff["role"] == "staff"
    team = successful(client.get("/api/v1/staff", headers=admin))
    assert any(user["id"] == staff["id"] for user in team["items"])
    staff_token = successful(client.post("/api/v1/auth/login", json={"email": staff_email, "password": password}))
    operator = {"Authorization": "Bearer " + staff_token["access_token"]}
    assert client.get("/api/v1/staff", headers=operator).status_code == 403
    customer = successful(client.post("/api/v1/customers/accounts", headers=operator, json={
        "email": f"managed-{uuid4().hex}@example.com", "password": password,
        "display_name": "Managed Customer", "billing_address": "20 Example Street",
    }), 201)
    assert customer["display_name"] == "Managed Customer"
    assert customer["billing_address"] == "20 Example Street"
    assert client.get(f"/api/v1/customers/{customer['id']}", headers=headers).status_code == 404
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    preflight = client.options("/api/v1/payments", headers={"Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type,idempotency-key"})
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_customer_quote_through_manual_settlement_and_renewal(client, make_user, login_headers):
    admin = login_headers(make_user(UserRole.ADMIN))
    operator = login_headers(make_user(UserRole.STAFF))
    customer = login_headers(make_user())
    other = login_headers(make_user())
    tax = successful(client.post("/api/v1/tax-rates", headers=admin, json={"name": uuid4().hex, "rate": "10"}), 201)
    code = "SAVE_" + uuid4().hex.upper()
    successful(client.post("/api/v1/discounts", headers=admin, json={"code": code, "kind": "percentage", "value": "10"}), 201)
    assert client.post("/api/v1/tax-rates", headers=operator, json={"name": "Forbidden", "rate": "5"}).status_code == 403
    product = successful(client.post("/api/v1/products", headers=operator, json={
        "name": uuid4().hex, "type": "software", "sales_price": "100.00", "cost": "20.00", "currency": "USD",
    }), 201)
    variant = successful(client.post(f"/api/v1/products/{product['id']}/variants", headers=operator,
        json={"name": "Extra", "kind": "addon", "additional_price": "10.00"}), 201)
    plan = successful(client.post("/api/v1/plans", headers=operator, json={
        "name": uuid4().hex, "product_id": product["id"], "tax_rate_id": tax["id"], "price": "90.00", "billing_interval": "monthly",
    }), 201)
    assert client.get("/api/v1/products", headers=customer).status_code == 403
    assert any(item["id"] == plan["id"] for item in successful(client.get("/api/v1/plans", headers=customer))["items"])
    quote = successful(client.post("/api/v1/quotations", headers=customer, json={
        "lines": [{"plan_id": plan["id"], "quantity": 2, "variant_ids": [variant["id"]]}],
        "start_date": today().isoformat(), "discount_code": code,
    }), 201)
    assert (quote["subtotal"], quote["discount"], quote["tax"], quote["total"]) == ("200.00", "20.00", "18.00", "198.00")
    assert client.get(f"/api/v1/quotations/{quote['id']}", headers=other).status_code == 404
    for action in ("issue", "confirm"):
        successful(client.post(f"/api/v1/quotations/{quote['id']}/actions/{action}", headers=customer))
    subscription = successful(client.post("/api/v1/subscriptions", headers=customer, json={"quotation_id": quote["id"]}), 201)
    sub_path = f"/api/v1/subscriptions/{subscription['id']}"
    for action in ("activate", "pause", "resume"):
        successful(client.post(sub_path + "/actions/" + action, headers=customer))
    invoice_body = {"period_start": subscription["next_billing_date"], "issue_date": today().isoformat()}
    assert client.post(sub_path + "/invoices", headers=customer, json=invoice_body).status_code == 403
    invoice = successful(client.post(sub_path + "/invoices", headers=operator, json=invoice_body), 201)
    assert successful(client.post(sub_path + "/invoices", headers=operator, json=invoice_body), 201)["id"] == invoice["id"]
    invoice_path = f"/api/v1/invoices/{invoice['id']}"
    successful(client.post(invoice_path + "/confirm", headers=operator))
    payment_body = {"invoice_id": invoice["id"], "amount": "98.00", "method": "bank_transfer", "payment_date": today().isoformat(), "reference": "Integration receipt"}
    key = {"Idempotency-Key": str(uuid4())}
    assert client.post("/api/v1/payments", headers=customer | key, json=payment_body).status_code == 403
    payment = successful(client.post("/api/v1/payments", headers=operator | key, json=payment_body), 201)
    assert successful(client.post("/api/v1/payments", headers=operator | key, json=payment_body), 201)["id"] == payment["id"]
    assert successful(client.get(invoice_path, headers=customer))["outstanding_balance"] == "100.00"
    assert client.get(invoice_path, headers=other).status_code == 404
    assert successful(client.get("/api/v1/payments", headers=other))["total"] == 0
    metrics = successful(client.get("/api/v1/dashboard", headers=operator))
    assert metrics["revenue_collected"] == "98.00" and metrics["outstanding_balance"] == "100.00"
    report = successful(client.get("/api/v1/reports/revenue", headers=operator))
    assert report["items"][0]["collected"] == "98.00"
    assert client.get("/api/v1/dashboard", headers=customer).status_code == 403
    successful(client.post(sub_path + "/actions/close", headers=customer))
    renewed = successful(client.post(sub_path + "/renew", headers=customer, json={"start_date": today().isoformat()}), 201)
    assert renewed["state"] == "confirmed" and renewed["renewed_from_id"] == subscription["id"]
