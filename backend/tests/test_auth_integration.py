import secrets
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.exc import IntegrityError

from app.core.config import BACKEND_DIR
from app.core.errors import PublicError
from app.db.session import create_session_factory
from app.models import AuthSession, User, UserRole
from app.models.catalog import CustomerProfile
from app.schemas.auth import RegisterRequest
from app.services.auth import bootstrap_admin

pytestmark = pytest.mark.db


def test_register_customer(client, db_factory, password):
    response = client.post("/api/v1/auth/register", json={"email": "  Customer@EXAMPLE.com  ", "password": password})
    assert response.status_code == 201
    assert response.json()["email"] == "customer@example.com"
    assert response.json()["role"] == "customer"
    assert "password" not in response.text and "password_hash" not in response.text
    with db_factory() as session, session.begin():
        user = session.scalar(select(User).where(User.email == "customer@example.com"))
        assert user.password_hash.startswith("$argon2id$")
        assert user.created_at.tzinfo is not None


@pytest.mark.parametrize("body", [
    {}, {"email": "bad", "password": "Aa!123456"}, {"email": "valid@example.com"},
    {"password": "Aa!123456"}, {"email": "valid@example.com", "password": "Aa!12345"},
    {"email": "valid@example.com", "password": "lowercase!"},
    {"email": "valid@example.com", "password": "UPPERCASE!"},
    {"email": "valid@example.com", "password": "NoSpecial123"},
    {"email": "valid@example.com", "password": 123456789},
    {"email": "valid@example.com", "password": None},
    [], None,
])
def test_invalid_registration(client, body):
    response = client.post("/api/v1/auth/register", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert "input" not in response.text and "ctx" not in response.text


@pytest.mark.parametrize("role", ["admin", "staff", "customer"])
def test_registration_cannot_select_role(client, password, role):
    response = client.post("/api/v1/auth/register", json={"email": "elevate@example.com", "password": password, "role": role})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "extra_forbidden"


@pytest.mark.parametrize("path", ["register", "login"])
def test_malformed_json(client, path):
    response = client.post("/api/v1/auth/" + path, content="{", headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_duplicate_normalized_email(client, password):
    first = {"email": "duplicate@example.com", "password": password}
    assert client.post("/api/v1/auth/register", json=first).status_code == 201
    first["email"] = " DUPLICATE@EXAMPLE.COM "
    response = client.post("/api/v1/auth/register", json=first)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "registration_conflict"


def test_idna_equivalent_addresses_cannot_duplicate(client, password):
    response = client.post("/api/v1/auth/register", json={"email": "Person@bücher.de", "password": password})
    assert response.status_code == 201
    assert response.json()["email"] == "person@xn--bcher-kva.de"
    duplicate = client.post("/api/v1/auth/register", json={"email": "person@xn--bcher-kva.de", "password": password})
    assert duplicate.status_code == 409


def test_login_and_me(client, make_user, password):
    user = make_user()
    response = client.post("/api/v1/auth/login", json={"email": user.email.upper(), "password": password})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["expires_in"] == 1800
    token = response.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + token})
    assert me.status_code == 200
    assert me.json()["id"] == str(user.id)
    assert "password_hash" not in me.text and token not in me.text


def test_wrong_unknown_and_disabled_credentials_same_error(client, make_user, password):
    user, disabled = make_user(), make_user(active=False)
    responses = [client.post("/api/v1/auth/login", json=body) for body in (
        {"email": user.email, "password": secrets.token_urlsafe(20)},
        {"email": "unknown@example.com", "password": password},
        {"email": disabled.email, "password": password},
    )]
    assert all(response.status_code == 401 for response in responses)
    assert len({response.text for response in responses}) == 1


@pytest.mark.parametrize("body", [{}, {"email": "invalid", "password": "anything"}, {"email": "valid@example.com"}, {"password": "anything"}, {"email": "valid@example.com", "password": ""}])
def test_invalid_login_body(client, body):
    assert client.post("/api/v1/auth/login", json=body).status_code == 422


def test_disabled_after_login(client, db_factory, make_user, login_headers):
    user = make_user()
    headers = login_headers(user)
    with db_factory() as session, session.begin():
        session.execute(update(User).where(User.id == user.id).values(is_active=False))
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_me_ignores_client_supplied_identity(client, make_user, login_headers):
    first, second = make_user(), make_user()
    response = client.get("/api/v1/auth/me", headers=login_headers(first), params={"user_id": str(second.id)})
    assert response.status_code == 200
    assert response.json()["id"] == str(first.id)


def test_request_session_rolls_back_unfinished_work(client, db_factory, password_hash):
    from app.dependencies.auth import DatabaseSession
    marker = f"unfinished-{uuid4().hex}@example.com"

    @client.app.app.post("/_test/unfinished")
    def unfinished(session: DatabaseSession):
        session.begin()
        session.add(User(email=marker, password_hash=password_hash))
        session.flush()
        return {"finished": False}

    assert client.post("/_test/unfinished").status_code == 200
    with db_factory() as session, session.begin():
        assert session.scalar(select(User.id).where(User.email == marker)) is None


@pytest.mark.parametrize("kind", ["expired", "signature", "missing_session"])
def test_me_rejects_forged_or_expired_tokens(client, settings, make_user, kind):
    user = make_user()
    now = int(datetime.now(UTC).timestamp())
    claims = {"sub": str(user.id), "jti": str(uuid4()), "iat": now, "nbf": now,
              "exp": now + 60, "iss": settings.jwt_issuer, "aud": settings.jwt_audience, "token_type": "access"}
    if kind == "expired": claims.update(iat=now - 120, nbf=now - 120, exp=now - 60)
    key = secrets.token_urlsafe(48) if kind == "signature" else settings.jwt_secret_key.get_secret_value()
    token = jwt.encode(claims, key, algorithm="HS256")
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer " + token})
    assert response.status_code == 401
    assert token not in response.text


def test_logout_revokes_only_current_session(client, make_user, login_headers):
    user = make_user()
    first, second = login_headers(user), login_headers(user)
    assert client.post("/api/v1/auth/logout", headers=first).status_code == 204
    assert client.get("/api/v1/auth/me", headers=first).status_code == 401
    assert client.post("/api/v1/auth/logout", headers=first).status_code == 401
    assert client.get("/api/v1/auth/me", headers=second).status_code == 200


@pytest.mark.parametrize("role,expected", [(UserRole.ADMIN, 201), (UserRole.STAFF, 403), (UserRole.CUSTOMER, 403)])
def test_staff_creation_rbac(client, make_user, login_headers, password, role, expected):
    response = client.post("/api/v1/staff", headers=login_headers(make_user(role)),
                           json={"email": "newstaff@example.com", "password": password})
    assert response.status_code == expected
    if expected == 201:
        assert response.json()["role"] == "staff"


def test_staff_creation_requires_auth(client, password):
    assert client.post("/api/v1/staff", json={"email": "staff@example.com", "password": password}).status_code == 401


def test_admin_cannot_use_staff_endpoint_to_create_admin(client, make_user, login_headers, password):
    response = client.post("/api/v1/staff", headers=login_headers(make_user(UserRole.ADMIN)),
                           json={"email": "anotheradmin@example.com", "password": password, "role": "admin"})
    assert response.status_code == 422


def test_role_is_reloaded_from_database(client, db_factory, make_user, login_headers, password):
    admin = make_user(UserRole.ADMIN)
    headers = login_headers(admin)
    with db_factory() as session, session.begin():
        session.execute(update(User).where(User.id == admin.id).values(role=UserRole.CUSTOMER))
    assert client.post("/api/v1/staff", headers=headers, json={"email": "staff@example.com", "password": password}).status_code == 403


def test_database_uniqueness_and_rollback(db_factory, make_user, password_hash):
    existing = make_user()
    with db_factory() as session:
        with pytest.raises(IntegrityError):
            with session.begin():
                session.add(User(email=existing.email, password_hash=password_hash, role=UserRole.CUSTOMER))
                session.flush()
        with session.begin():
            assert session.scalar(select(func.count()).select_from(User).where(User.email == existing.email)) == 1


@pytest.mark.parametrize("email,role", [("UPPER@example.com", "customer"), ("constraint@example.com", "owner")])
def test_database_constraints(db_factory, password_hash, email, role):
    with db_factory() as session, pytest.raises(IntegrityError):
        with session.begin():
            session.execute(text("INSERT INTO users (id,email,password_hash,role) VALUES (:id,:email,:hash,:role)"),
                            {"id": uuid4(), "email": email, "hash": password_hash, "role": role})


def test_atomic_rollback(db_factory, password_hash):
    marker = f"rollback-{uuid4().hex}@example.com"
    with db_factory() as session:
        with pytest.raises(RuntimeError):
            with session.begin():
                session.add(User(email=marker, password_hash=password_hash))
                session.flush()
                raise RuntimeError("controlled failure")
        with session.begin():
            assert session.scalar(select(User.id).where(User.email == marker)) is None


def test_bootstrap_first_only(db_factory, password):
    with db_factory() as session:
        admin = bootstrap_admin(session, RegisterRequest(email="firstadmin@example.com", password=password))
        assert admin.role == UserRole.ADMIN
        with pytest.raises(PublicError) as failure:
            bootstrap_admin(session, RegisterRequest(email="secondadmin@example.com", password=password))
        assert failure.value.code == "admin_exists"


def test_bootstrap_never_promotes_existing_customer(db_factory, make_user, password):
    user = make_user()
    with db_factory() as session:
        with pytest.raises(PublicError):
            bootstrap_admin(session, RegisterRequest(email=user.email, password=password))
        with session.begin():
            assert session.get(User, user.id).role == UserRole.CUSTOMER


def test_concurrent_duplicate_registration(client, db_engine, password):
    factory = create_session_factory(db_engine)
    client.app.app.state.session_factory = factory
    marker = f"race-{uuid4().hex}@example.com"
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(lambda _: client.post("/api/v1/auth/register", json={"email": marker, "password": password}).status_code, range(2)))
        assert sorted(statuses) == [201, 409]
        with factory() as session, session.begin():
            assert session.scalar(select(func.count()).select_from(User).where(User.email == marker)) == 1
    finally:
        # Only this test's unique, committed record in the marked test database.
        with factory() as session, session.begin():
            session.execute(delete(CustomerProfile).where(CustomerProfile.id.in_(select(User.id).where(User.email == marker))))
            session.execute(delete(User).where(User.email == marker))


def test_migration_matches_metadata_and_repeats(db_engine):
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    with db_engine.connect() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        command.check(config)
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == ScriptDirectory.from_config(config).get_current_head()


def test_concurrent_bootstrap_creates_only_one_admin(db_engine, password):
    factory = create_session_factory(db_engine)
    marker = uuid4().hex
    emails = [f"bootstrap-{marker}-{number}@example.com" for number in (1, 2)]

    def attempt(email):
        try:
            with factory() as session:
                bootstrap_admin(session, RegisterRequest(email=email, password=password))
            return "created"
        except PublicError as error:
            return error.code

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            outcomes = list(executor.map(attempt, emails))
        assert sorted(outcomes) == ["admin_exists", "created"]
    finally:
        with factory() as session, session.begin():
            session.execute(delete(User).where(User.email.in_(emails)))
