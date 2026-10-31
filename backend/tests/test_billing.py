from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from app.models.user import UserRole
from app.services.common import today
from test_catalog import catalog, operator_headers, product_body
from test_commerce import active_subscription, agreement

pytestmark = pytest.mark.db


@pytest.fixture
def invoice(client, active_subscription, operator_headers):
    subscription = active_subscription["subscription"]
    result = client.post(f"/api/v1/subscriptions/{subscription['id']}/invoices", headers=operator_headers,
        json={"period_start": subscription["next_billing_date"]})
    assert result.status_code == 201
    return active_subscription | {"invoice": result.json()}


def test_generate_retry_confirm_partial_payment(client, invoice, operator_headers):
    record = invoice["invoice"]
    body = {"period_start": record["period_start"]}
    repeated = client.post(f"/api/v1/subscriptions/{record['subscription_id']}/invoices", headers=operator_headers, json=body)
    assert repeated.status_code == 201 and repeated.json()["id"] == record["id"]
    assert client.post(f"/api/v1/invoices/{record['id']}/confirm", headers=operator_headers).status_code == 200
    payment = {"invoice_id": record["id"], "amount": "50.00", "method": "bank_transfer", "payment_date": today().isoformat()}
    headers = operator_headers | {"Idempotency-Key": str(uuid4())}
    first = client.post("/api/v1/payments", headers=headers, json=payment)
    assert first.status_code == 201
    again = client.post("/api/v1/payments", headers=headers, json=payment | {"amount": "50.0"})
    assert again.status_code == 201 and again.json()["id"] == first.json()["id"]
    result = client.get(f"/api/v1/invoices/{record['id']}", headers=operator_headers).json()
    assert result["outstanding_balance"] == "150.00"
    assert client.post("/api/v1/payments", headers=headers, json=payment | {"amount": "51.00"}).status_code == 409
    assert client.post("/api/v1/payments", headers=operator_headers | {"Idempotency-Key": str(uuid4())},
                       json=payment | {"amount": "151.00"}).status_code == 409


def test_payment_requires_confirmation_and_key(client, invoice, operator_headers):
    body = {"invoice_id": invoice["invoice"]["id"], "amount": "10.00", "method": "cash", "payment_date": today().isoformat()}
    assert client.post("/api/v1/payments", headers=operator_headers, json=body).status_code == 422
    assert client.post("/api/v1/payments", headers=operator_headers | {"Idempotency-Key": str(uuid4())}, json=body).status_code == 409


def test_invoice_and_payment_customer_isolation(client, invoice, operator_headers, make_user, login_headers):
    other = login_headers(make_user())
    identifier = invoice["invoice"]["id"]
    assert client.get(f"/api/v1/invoices/{identifier}", headers=other).status_code == 404
    assert client.get("/api/v1/invoices", headers=other).json()["total"] == 0
    assert client.get(f"/api/v1/invoices/{identifier}", headers=invoice["headers"]).status_code == 200
    assert client.post(f"/api/v1/invoices/{identifier}/confirm", headers=invoice["headers"]).status_code == 403
    assert client.post(f"/api/v1/invoices/{identifier}/confirm", headers=operator_headers).status_code == 200
    body = {"invoice_id": identifier, "amount": "10.00", "method": "cash", "payment_date": today().isoformat()}
    assert client.post("/api/v1/payments", headers=invoice["headers"] | {"Idempotency-Key": str(uuid4())}, json=body).status_code == 403
    result = client.post("/api/v1/payments", headers=operator_headers | {"Idempotency-Key": str(uuid4())}, json=body)
    assert result.status_code == 201
    assert client.get(f"/api/v1/payments/{result.json()['id']}", headers=other).status_code == 404
    assert client.get("/api/v1/payments", headers=other).json()["total"] == 0
    assert client.get("/api/v1/dashboard", headers=invoice["headers"]).status_code == 403


def test_future_and_skipped_period_refused(client, active_subscription, operator_headers):
    identifier = active_subscription["subscription"]["id"]
    response = client.post(f"/api/v1/subscriptions/{identifier}/invoices", headers=operator_headers,
        json={"period_start": (today() - timedelta(days=1)).isoformat()})
    assert response.status_code == 409
    response = client.post(f"/api/v1/subscriptions/{identifier}/invoices", headers=operator_headers,
        json={"period_start": (today() + timedelta(days=1)).isoformat()})
    assert response.status_code == 422


def test_tax_discount_snapshot_and_dashboard(client, catalog, operator_headers, make_user, login_headers):
    admin = login_headers(make_user(UserRole.ADMIN))
    tax = client.post("/api/v1/tax-rates", headers=admin, json={"name": uuid4().hex, "rate": "10"})
    assert tax.status_code == 201
    plan_body = {key: value for key, value in catalog["plan"].items() if key not in {"id", "created_at", "updated_at", "currency", "product_name"}}
    plan_body["tax_rate_id"] = tax.json()["id"]
    assert client.put(f"/api/v1/plans/{catalog['plan']['id']}", headers=operator_headers, json=plan_body).status_code == 200
    code = "D" + uuid4().hex.upper()
    discount = client.post("/api/v1/discounts", headers=admin,
        json={"code": code, "kind": "percentage", "value": "10", "usage_limit": 1})
    assert discount.status_code == 201
    customer = make_user()
    start = today() - timedelta(days=65)
    quote = client.post("/api/v1/quotations", headers=operator_headers, json={"customer_id": str(customer.id),
        "lines": [{"plan_id": catalog["plan"]["id"], "quantity": 2, "variant_ids": [catalog["variant"]["id"]]}],
        "start_date": start.isoformat(), "discount_code": code})
    assert quote.status_code == 201
    assert quote.json()["subtotal"] == "200.00" and quote.json()["total"] == "198.00"
    for action in ("issue", "confirm"):
        assert client.post(f"/api/v1/quotations/{quote.json()['id']}/actions/{action}", headers=operator_headers).status_code == 200
    subscription = client.post("/api/v1/subscriptions", headers=operator_headers, json={"quotation_id": quote.json()["id"]}).json()
    assert client.post(f"/api/v1/subscriptions/{subscription['id']}/actions/activate", headers=operator_headers).status_code == 200
    body = {"period_start": start.isoformat(), "issue_date": start.isoformat()}
    first = client.post(f"/api/v1/subscriptions/{subscription['id']}/invoices", headers=operator_headers, json=body)
    assert first.status_code == 201 and first.json()["total"] == "198.00"
    identifier = first.json()["id"]
    assert client.post(f"/api/v1/invoices/{identifier}/confirm", headers=operator_headers).json()["status"] == "overdue"
    assert client.put(f"/api/v1/tax-rates/{tax.json()['id']}", headers=admin,
        json={"name": tax.json()["name"], "rate": "50"}).status_code == 200
    subscription = client.get(f"/api/v1/subscriptions/{subscription['id']}", headers=operator_headers).json()
    second = client.post(f"/api/v1/subscriptions/{subscription['id']}/invoices", headers=operator_headers,
        json={"period_start": subscription["next_billing_date"]})
    assert second.status_code == 201 and second.json()["discount"] == "0.00"
    assert second.json()["tax"] == "20.00"
    assert second.json()["discount_snapshot"]["eligibility"] == "usage_limit"
    assert client.get(f"/api/v1/discounts/{discount.json()['id']}", headers=admin).json()["used_count"] == 1
    payment = client.post("/api/v1/payments", headers=operator_headers | {"Idempotency-Key": str(uuid4())},
        json={"invoice_id": identifier, "amount": "98.00", "method": "cash", "payment_date": today().isoformat()})
    assert payment.status_code == 201
    metrics = client.get("/api/v1/dashboard", headers=operator_headers).json()
    assert metrics["revenue_collected"] == "98.00"
    assert metrics["outstanding_balance"] == "100.00" and metrics["overdue_invoice_count"] == 1
    assert metrics["invoiced_total"] == "198.00"  # second invoice remains draft
    report = client.get("/api/v1/reports/revenue", headers=operator_headers, params={"granularity": "day"})
    assert report.status_code == 200 and report.json()["items"][0]["collected"] == "98.00"


@pytest.mark.parametrize("path,body", [
    ("tax-rates", {"name": "bad", "rate": "101"}),
    ("discounts", {"code": "BAD", "kind": "percentage", "value": "101"}),
    ("discounts", {"code": "BAD", "kind": "fixed", "value": "1.001"}),
])
def test_invalid_finance_configuration(client, make_user, login_headers, path, body):
    headers = login_headers(make_user(UserRole.ADMIN))
    assert client.post("/api/v1/" + path, headers=headers, json=body).status_code == 422


def test_staff_cannot_change_tax_rules(client, operator_headers):
    assert client.post("/api/v1/tax-rates", headers=operator_headers, json={"name": "tax", "rate": "5"}).status_code == 403
