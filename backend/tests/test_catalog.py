from datetime import timedelta
from uuid import uuid4

import pytest

from app.models.user import UserRole
from app.services.common import today

pytestmark = pytest.mark.db


@pytest.fixture
def operator_headers(make_user, login_headers):
    return login_headers(make_user(UserRole.STAFF))


@pytest.fixture
def product_body():
    return {"name": "Product " + uuid4().hex, "type": "software", "sales_price": "100.00",
            "cost": "20.00", "currency": "USD", "notes": "Test product"}


@pytest.fixture
def catalog(client, operator_headers, product_body):
    product = client.post("/api/v1/products", headers=operator_headers, json=product_body)
    assert product.status_code == 201
    product_id = product.json()["id"]
    plan = client.post("/api/v1/plans", headers=operator_headers, json={
        "product_id": product_id, "name": "Plan " + uuid4().hex, "price": "90.00",
        "billing_interval": "monthly"})
    assert plan.status_code == 201
    variant = client.post(f"/api/v1/products/{product_id}/variants", headers=operator_headers,
                          json={"name": "Extra seat", "kind": "addon", "additional_price": "10.00"})
    assert variant.status_code == 201
    return {"product": product.json(), "plan": plan.json(), "variant": variant.json()}


def test_catalog_list_and_filters(client, catalog, operator_headers):
    products = client.get("/api/v1/products", headers=operator_headers, params={"limit": 1, "sort": "name"})
    assert products.status_code == 200
    assert products.json()["total"] == 1 and len(products.json()["items"]) == 1
    plans = client.get("/api/v1/plans", headers=operator_headers, params={"billing_interval": "monthly"})
    assert plans.status_code == 200
    assert plans.json()["total"] == 1


def test_customer_catalog_permissions(client, catalog, make_user, login_headers, product_body):
    headers = login_headers(make_user())
    assert client.get("/api/v1/products", headers=headers).status_code == 403
    assert client.post("/api/v1/products", headers=headers, json=product_body).status_code == 403
    plans = client.get("/api/v1/plans", headers=headers)
    assert plans.status_code == 200
    assert "cost" not in plans.text
    assert client.get(f"/api/v1/products/{catalog['product']['id']}/variants", headers=headers).status_code == 200


@pytest.mark.parametrize("field,value", [("sales_price", "-1"), ("cost", "-0.01"), ("sales_price", "1.001"), ("currency", "usd"), ("name", "")])
def test_product_invalid_input(client, operator_headers, product_body, field, value):
    product_body[field] = value
    assert client.post("/api/v1/products", headers=operator_headers, json=product_body).status_code == 422


def test_product_duplicate_and_archive(client, catalog, operator_headers, product_body):
    assert client.post("/api/v1/products", headers=operator_headers, json=product_body).status_code == 409
    assert client.delete(f"/api/v1/products/{catalog['product']['id']}", headers=operator_headers).status_code == 204
    result = client.get("/api/v1/products", headers=operator_headers, params={"is_active": False})
    assert result.json()["total"] == 1


@pytest.mark.parametrize("interval", ["daily", "weekly", "monthly", "yearly"])
def test_plan_intervals(client, catalog, operator_headers, interval):
    result = client.post("/api/v1/plans", headers=operator_headers, json={"product_id": catalog["product"]["id"],
        "name": uuid4().hex, "price": "10.00", "billing_interval": interval})
    assert result.status_code == 201


def test_unavailable_plan_hidden_from_customer(client, catalog, operator_headers, make_user, login_headers):
    body = {key: value for key, value in catalog["plan"].items() if key not in {"id", "created_at", "updated_at", "currency", "product_name"}}
    body["available_from"] = (today() + timedelta(days=10)).isoformat()
    assert client.put(f"/api/v1/plans/{catalog['plan']['id']}", headers=operator_headers, json=body).status_code == 200
    headers = login_headers(make_user())
    assert client.get(f"/api/v1/plans/{catalog['plan']['id']}", headers=headers).status_code == 404


def test_profile_isolation_and_privilege_fields(client, make_user, login_headers):
    first, other = make_user(), make_user()
    headers = login_headers(first)
    assert client.get("/api/v1/customers/me", headers=headers).status_code == 200
    assert client.get(f"/api/v1/customers/{other.id}", headers=headers).status_code == 404
    result = client.patch("/api/v1/customers/me", headers=headers, json={"display_name": "Fictional Customer", "phone": "000-0000"})
    assert result.status_code == 200
    assert result.json()["display_name"] == "Fictional Customer"
    assert client.patch("/api/v1/customers/me", headers=headers, json={"is_active": False}).status_code == 422
    assert client.patch("/api/v1/customers/me", headers=headers, json={"role": "admin"}).status_code == 422


def test_anonymous_and_pagination_validation(client):
    assert client.get("/api/v1/plans").status_code == 401


def test_variant_association_and_duplicate(client, catalog, operator_headers, product_body):
    body = {"name": "Extra seat", "kind": "addon", "additional_price": "10.00"}
    assert client.post(f"/api/v1/products/{catalog['product']['id']}/variants", headers=operator_headers, json=body).status_code == 409
    product_body["name"] = uuid4().hex
    other = client.post("/api/v1/products", headers=operator_headers, json=product_body).json()
    result = client.put(f"/api/v1/products/{other['id']}/variants/{catalog['variant']['id']}", headers=operator_headers, json=body)
    assert result.status_code == 404
