from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import update

from app.models.commerce import Quotation
from app.services.common import today
from test_catalog import catalog, operator_headers, product_body

pytestmark = pytest.mark.db


@pytest.fixture
def agreement(client, catalog, make_user, login_headers):
    customer = make_user()
    headers = login_headers(customer)
    body = {"lines": [{"plan_id": catalog["plan"]["id"], "quantity": 2,
                        "variant_ids": [catalog["variant"]["id"]]}]}
    response = client.post("/api/v1/quotations", headers=headers, json=body)
    assert response.status_code == 201
    return {"quote": response.json(), "headers": headers, "body": body, "customer": customer}


@pytest.fixture
def active_subscription(client, agreement):
    headers, quote_id = agreement["headers"], agreement["quote"]["id"]
    for action in ("issue", "confirm"):
        assert client.post(f"/api/v1/quotations/{quote_id}/actions/{action}", headers=headers).status_code == 200
    response = client.post("/api/v1/subscriptions", headers=headers, json={"quotation_id": quote_id})
    assert response.status_code == 201
    subscription_id = response.json()["id"]
    response = client.post(f"/api/v1/subscriptions/{subscription_id}/actions/activate", headers=headers)
    assert response.status_code == 200
    return agreement | {"subscription": response.json()}


def test_quote_price_snapshot(client, agreement, catalog, operator_headers):
    assert agreement["quote"]["total"] == "200.00"
    plan_body = {key: value for key, value in catalog["plan"].items() if key not in {"id", "created_at", "updated_at", "currency", "product_name"}}
    plan_body["price"] = "500.00"
    assert client.put(f"/api/v1/plans/{catalog['plan']['id']}", headers=operator_headers, json=plan_body).status_code == 200
    response = client.get(f"/api/v1/quotations/{agreement['quote']['id']}", headers=agreement["headers"])
    assert response.json()["total"] == "200.00"


def test_quote_invalid_transitions_and_edit(client, agreement):
    path = f"/api/v1/quotations/{agreement['quote']['id']}"
    headers = agreement["headers"]
    assert client.post(path + "/actions/confirm", headers=headers).status_code == 409
    assert client.put(path, headers=headers, json=agreement["body"]).status_code == 200
    assert client.post(path + "/actions/issue", headers=headers).status_code == 200
    assert client.put(path, headers=headers, json=agreement["body"]).status_code == 409
    assert client.post(path + "/actions/issue", headers=headers).status_code == 200


def test_quote_expiration(client, agreement, db_factory):
    from uuid import UUID
    with db_factory() as session, session.begin():
        session.execute(update(Quotation).where(Quotation.id == UUID(agreement["quote"]["id"])).values(valid_until=today() - timedelta(days=1)))
    path = f"/api/v1/quotations/{agreement['quote']['id']}"
    assert client.get(path, headers=agreement["headers"]).json()["is_expired"]
    assert client.post(path + "/actions/issue", headers=agreement["headers"]).status_code == 409


def test_agreement_customer_isolation(client, active_subscription, make_user, login_headers):
    other = login_headers(make_user())
    for resource, key in (("quotations", "quote"), ("subscriptions", "subscription")):
        resource_id = active_subscription[key]["id"]
        assert client.get(f"/api/v1/{resource}/{resource_id}", headers=other).status_code == 404
        assert client.get(f"/api/v1/{resource}", headers=other).json()["total"] == 0
    quote_id = active_subscription["quote"]["id"]
    assert client.post("/api/v1/subscriptions", headers=other, json={"quotation_id": quote_id}).status_code == 404
    body = active_subscription["body"] | {"customer_id": str(active_subscription["customer"].id)}
    assert client.post("/api/v1/quotations", headers=other, json=body).status_code == 403


def test_subscription_pause_resume_close_renew(client, active_subscription):
    headers = active_subscription["headers"]
    path = "/api/v1/subscriptions/" + active_subscription["subscription"]["id"]
    for action, state in (("pause", "paused"), ("pause", "paused"), ("resume", "active"), ("close", "closed")):
        response = client.post(path + "/actions/" + action, headers=headers)
        assert response.status_code == 200 and response.json()["state"] == state
    assert client.post(path + "/actions/activate", headers=headers).status_code == 409
    response = client.post(path + "/renew", headers=headers, json={"start_date": today().isoformat()})
    assert response.status_code == 201 and response.json()["state"] == "confirmed"
    again = client.post(path + "/renew", headers=headers, json={"start_date": today().isoformat()})
    assert again.json()["id"] == response.json()["id"]


def test_subscription_conversion_idempotent(client, active_subscription):
    response = client.post("/api/v1/subscriptions", headers=active_subscription["headers"],
                           json={"quotation_id": active_subscription["quote"]["id"]})
    assert response.status_code == 201
    assert response.json()["id"] == active_subscription["subscription"]["id"]


def test_template_creates_repriced_quote(client, catalog, operator_headers, agreement):
    response = client.post("/api/v1/quotation-templates", headers=operator_headers,
        json={"name": uuid4().hex, "selections": agreement["body"]["lines"], "validity_days": 10})
    assert response.status_code == 201
    result = client.post("/api/v1/quotations", headers=agreement["headers"], json={"template_id": response.json()["id"]})
    assert result.status_code == 201
    assert result.json()["total"] == agreement["quote"]["total"]


@pytest.mark.parametrize("change", [{"quantity": 0}, {"unit_price": "0.01"}, {"variant_ids": [str(uuid4())]}])
def test_quote_rejects_bad_selection(client, agreement, change):
    selection = agreement["body"]["lines"][0] | change
    response = client.post("/api/v1/quotations", headers=agreement["headers"], json={"lines": [selection]})
    assert response.status_code in {409, 422}
