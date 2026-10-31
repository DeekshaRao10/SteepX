from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.models.catalog import CustomerProfile
from app.models.commerce import Quotation
from app.schemas.billing import InvoiceGenerate, PaymentCreate
from app.schemas.commerce import RenewalRequest
from app.services.common import today
from test_catalog import catalog, operator_headers, product_body
from test_commerce import active_subscription, agreement
from test_billing import invoice


@pytest.mark.parametrize("value", ["2024-01-01T00:00:00Z", "2024-01-01T23:30:00-05:00", 1704067200, True, "2024-02-30"])
def test_billing_dates_reject_timestamps_and_invalid_dates(value):
    with pytest.raises(ValidationError):
        InvoiceGenerate(period_start=value)


@pytest.mark.db
@pytest.mark.parametrize("interval,anchor,ends", [
    ("daily", "2024-02-28", ["2024-02-29", "2024-03-01"]),
    ("weekly", "2024-02-23", ["2024-03-01", "2024-03-08"]),
    ("monthly", "2024-01-31", ["2024-02-29", "2024-03-31"]),
    ("monthly", "2023-01-30", ["2023-02-28", "2023-03-30"]),
    ("yearly", "2023-02-28", ["2024-02-29", "2025-02-28"]),
])
def test_real_invoice_calendar_and_catchup(client, catalog, operator_headers, make_user, interval, anchor, ends):
    plan = client.post("/api/v1/plans", headers=operator_headers, json={"product_id": catalog["product"]["id"],
        "name": uuid4().hex, "price": "10", "billing_interval": interval}).json()
    quote = client.post("/api/v1/quotations", headers=operator_headers, json={"customer_id": str(make_user().id),
        "start_date": anchor, "lines": [{"plan_id": plan["id"]}]}).json()
    for action in ("issue", "confirm"):
        assert client.post(f"/api/v1/quotations/{quote['id']}/actions/{action}", headers=operator_headers).status_code == 200
    subscription = client.post("/api/v1/subscriptions", headers=operator_headers, json={"quotation_id": quote["id"]}).json()
    path = f"/api/v1/subscriptions/{subscription['id']}"
    assert client.post(path + "/actions/activate", headers=operator_headers).status_code == 200
    assert client.post(path + "/invoices", headers=operator_headers, json={"period_start": ends[0]}).status_code == 409
    start = anchor
    for index, end in enumerate(ends):
        response = client.post(path + "/invoices", headers=operator_headers, json={"period_start": start})
        assert response.status_code == 201
        assert response.json()["period_index"] == index and response.json()["period_end"] == end
        assert response.json()["total"] == "10.00"
        start = end
    assert client.get(path, headers=operator_headers).json()["next_billing_date"] == ends[-1]


@pytest.mark.db
def test_full_settlement_and_currency_filters(client, invoice, operator_headers):
    identifier = invoice["invoice"]["id"]
    client.post(f"/api/v1/invoices/{identifier}/confirm", headers=operator_headers)
    response = client.post("/api/v1/payments", headers=operator_headers | {"Idempotency-Key": str(uuid4())}, json={
        "invoice_id": identifier, "amount": invoice["invoice"]["total"], "method": "cash", "payment_date": today().isoformat()})
    assert response.status_code == 201
    paid = client.get(f"/api/v1/invoices/{identifier}", headers=operator_headers).json()
    assert paid["status"] == "paid" and paid["outstanding_balance"] == "0.00"
    excluded = client.get("/api/v1/dashboard", headers=operator_headers, params={"currency": "EUR"}).json()
    assert excluded["revenue_collected"] == "0.00" and excluded["active_subscriptions"] == 0
    future = (today() + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/reports/revenue", headers=operator_headers, params={"date_from": future, "date_to": future}).json()["items"] == []


@pytest.mark.db
def test_expiration_and_disabled_customer_activation(client, agreement, operator_headers, db_factory):
    quote_id = agreement["quote"]["id"]
    with db_factory() as session, session.begin():
        session.get(Quotation, UUID(quote_id)).valid_until = today() - timedelta(days=1)
    assert client.post(f"/api/v1/quotations/{quote_id}/actions/issue", headers=operator_headers).status_code == 409
    assert client.get(f"/api/v1/quotations/{quote_id}", headers=agreement["headers"]).json()["is_expired"] is True
    with db_factory() as session, session.begin():
        session.get(Quotation, UUID(quote_id)).valid_until = today()
    for action in ("issue", "confirm"):
        assert client.post(f"/api/v1/quotations/{quote_id}/actions/{action}", headers=operator_headers).status_code == 200
    subscription = client.post("/api/v1/subscriptions", headers=operator_headers, json={"quotation_id": quote_id}).json()
    with db_factory() as session, session.begin():
        session.get(CustomerProfile, UUID(subscription["customer_id"])).is_active = False
    assert client.post(f"/api/v1/subscriptions/{subscription['id']}/actions/activate", headers=operator_headers).status_code == 409


@pytest.mark.db
@pytest.mark.parametrize("change", [{"minimum_quantity": 3}, {"is_active": False}, {"available_until": "2020-01-01"}])
def test_unavailable_or_minimum_plan_refused(client, catalog, operator_headers, make_user, change):
    body = {key: value for key, value in catalog["plan"].items() if key not in {"id", "created_at", "updated_at", "currency", "product_name"}}
    assert client.put(f"/api/v1/plans/{catalog['plan']['id']}", headers=operator_headers, json=body | change).status_code == 200
    response = client.post("/api/v1/quotations", headers=operator_headers, json={"customer_id": str(make_user().id),
        "lines": [{"plan_id": catalog["plan"]["id"], "quantity": 2}]})
    assert response.status_code == 409


@pytest.mark.db
def test_clipped_period_and_natural_term_expiry(client, catalog, operator_headers, make_user, db_factory):
    customer = make_user()
    start = today() - timedelta(days=5)
    quote = client.post("/api/v1/quotations", headers=operator_headers, json={"customer_id": str(customer.id),
        "start_date": start.isoformat(), "end_date": (today() + timedelta(days=1)).isoformat(),
        "lines": [{"plan_id": catalog["plan"]["id"]}]}).json()
    for action in ("issue", "confirm"):
        client.post(f"/api/v1/quotations/{quote['id']}/actions/{action}", headers=operator_headers)
    subscription = client.post("/api/v1/subscriptions", headers=operator_headers, json={"quotation_id": quote["id"]}).json()
    path = f"/api/v1/subscriptions/{subscription['id']}"
    assert client.post(path + "/actions/activate", headers=operator_headers).status_code == 200
    assert client.post(path + "/actions/pause", headers=operator_headers).status_code == 200
    assert client.post(path + "/invoices", headers=operator_headers, json={"period_start": start.isoformat()}).status_code == 409
    assert client.post(path + "/actions/resume", headers=operator_headers).status_code == 200
    result = client.post(path + "/invoices", headers=operator_headers, json={"period_start": start.isoformat()})
    assert result.status_code == 201
    assert result.json()["period_end"] == (today() + timedelta(days=1)).isoformat()
    assert result.json()["total"] == "90.00"  # deliberate full-period charge, no proration
    from app.models.commerce import Subscription
    with db_factory() as session, session.begin():
        session.get(Subscription, UUID(subscription["id"])).term_end = today()
    assert client.get(path, headers=operator_headers).json()["state"] == "closed"
    assert client.post(path + "/actions/resume", headers=operator_headers).status_code == 409
    metrics = client.get("/api/v1/dashboard", headers=operator_headers, params={"customer_id": str(customer.id)}).json()
    assert metrics["active_subscriptions"] == 0 and metrics["subscription_counts"]["closed"] == 1


@pytest.mark.db
def test_zero_invoice_confirms_paid(client, catalog, operator_headers, make_user):
    plan = client.post("/api/v1/plans", headers=operator_headers, json={"product_id": catalog["product"]["id"],
        "name": uuid4().hex, "price": "0.00", "billing_interval": "daily", "end_behavior": "close"}).json()
    quote = client.post("/api/v1/quotations", headers=operator_headers, json={"customer_id": str(make_user().id),
        "lines": [{"plan_id": plan["id"]}]}).json()
    for action in ("issue", "confirm"):
        client.post(f"/api/v1/quotations/{quote['id']}/actions/{action}", headers=operator_headers)
    subscription = client.post("/api/v1/subscriptions", headers=operator_headers, json={"quotation_id": quote["id"]}).json()
    assert subscription["term_end"] == (today() + timedelta(days=1)).isoformat()
    path = f"/api/v1/subscriptions/{subscription['id']}"
    client.post(path + "/actions/activate", headers=operator_headers)
    invoice = client.post(path + "/invoices", headers=operator_headers, json={"period_start": today().isoformat()}).json()
    response = client.post(f"/api/v1/invoices/{invoice['id']}/confirm", headers=operator_headers)
    assert response.status_code == 200 and response.json()["status"] == "paid"
    assert response.json()["outstanding_balance"] == "0.00"
