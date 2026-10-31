from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import Depends

from app.core.permissions import require_admin, require_customer, require_operator
from app.dependencies.auth import get_current_user
from app.models import UserRole
from app.schemas.auth import UserResponse
from app.services.auth import AuthenticatedUser


def test_health(public_client):
    response = public_client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Brightloop Subscription API"}


def test_openapi(public_client):
    response = public_client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert {"/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/staff"} <= schema["paths"].keys()
    assert schema["paths"]["/api/v1/auth/me"]["get"]["security"]
    assert "role" not in schema["components"]["schemas"]["RegisterRequest"]["properties"]
    assert "password_hash" not in schema["components"]["schemas"]["UserResponse"]["properties"]


@pytest.mark.parametrize("path", ["/api/v1/auth/admin", "/api/v1/auth/bootstrap", "/api/v1/admin/register"])
def test_no_public_admin_bootstrap(public_client, path):
    response = public_client.post(path, json={})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("method,path,expected", [("post", "/api/v1/health", 405), ("get", "/missing", 404)])
def test_error_envelope(public_client, method, path, expected):
    response = getattr(public_client, method)(path)
    assert response.status_code == expected
    assert set(response.json()) == {"error"}
    assert "Traceback" not in response.text


@pytest.mark.parametrize("origin,expected", [("http://localhost:3000", 200), ("https://unapproved.example", 400)])
def test_cors(public_client, origin, expected):
    response = public_client.options("/api/v1/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
    assert response.status_code == expected
    if expected == 400:
        assert response.json()["error"]["code"] == "cors_not_allowed"


@pytest.mark.parametrize("role", list(UserRole))
@pytest.mark.parametrize("policy,allowed", [(require_admin, {UserRole.ADMIN}), (require_operator, {UserRole.ADMIN, UserRole.STAFF}), (require_customer, {UserRole.CUSTOMER})])
def test_role_dependency_only_test_routes(public_client, role, policy, allowed):
    api = public_client.app.app
    now = datetime.now(UTC)
    identity = AuthenticatedUser(UserResponse(id=uuid4(), email="role@example.com", role=role,
                                is_active=True, created_at=now, updated_at=now), uuid4())
    api.dependency_overrides[get_current_user] = lambda: identity

    @api.get("/_test/role", dependencies=[Depends(policy)])
    def test_route():
        return {"allowed": True}

    response = public_client.get("/_test/role")
    assert response.status_code == (200 if role in allowed else 403)


def test_unexpected_errors_are_sanitized(public_client):
    @public_client.app.app.get("/_test/failure")
    def fail():
        raise RuntimeError("sensitive-placeholder")

    response = public_client.get("/_test/failure", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 500
    assert "sensitive-placeholder" not in response.text
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


@pytest.mark.parametrize("header", [None, "Basic invalid", "Bearer", "Bearer malformed"])
def test_me_without_valid_bearer(public_client, header):
    response = public_client.get("/api/v1/auth/me", headers={} if header is None else {"Authorization": header})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
