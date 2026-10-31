import secrets
from dataclasses import replace
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.application import create_app
from app.core.config import BACKEND_DIR, Settings
from app.core.security import hash_password
from app.models import User, UserRole
from app.models.catalog import CustomerProfile
from app.schemas.auth import UserResponse
from app.services.auth import AuthenticatedUser
from scripts.local_database import confirmed_engine, test_database_name


def pytest_addoption(parser):
    parser.addoption("--run-db", action="store_true", help="Use the marked, isolated local PostgreSQL test database")


def pytest_collection_modifyitems(config, items):
    if not config.getoption("--run-db"):
        for item in items:
            if "db" in item.keywords:
                item.add_marker(pytest.mark.skip(reason="PostgreSQL integration requires --run-db and a prepared isolated target"))


@pytest.fixture(scope="session")
def signing_secret():
    return secrets.token_urlsafe(48)


@pytest.fixture
def settings(signing_secret):
    return Settings(_env_file=None, database_url="postgresql+psycopg://unused@127.0.0.1/unused",
                    jwt_secret_key=signing_secret, cors_origins=["http://localhost:3000"])


@pytest.fixture
def public_client(settings):
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        yield client


@pytest.fixture(scope="session")
def password():
    return "Aa!" + secrets.token_urlsafe(18)


@pytest.fixture(scope="session")
def password_hash(password):
    return hash_password(password)


@pytest.fixture(scope="session")
def db_engine():
    engine = confirmed_engine(test_name=test_database_name())
    # migrations/env.py accepts only this programmatic connection override. The
    # target has been checked before any DDL; migration operations are additive.
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    with engine.connect() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db_factory(db_engine):
    with db_engine.connect() as connection:
        outer = connection.begin()
        factory = sessionmaker(bind=connection, class_=Session, autobegin=False,
                               autoflush=False, expire_on_commit=False,
                               join_transaction_mode="create_savepoint")
        yield factory
        if outer.is_active:
            outer.rollback()


@pytest.fixture
def client(settings, db_factory):
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        client.app.app.state.session_factory = db_factory
        yield client


@pytest.fixture
def make_user(db_factory, password_hash):
    def create(role=UserRole.CUSTOMER, active=True):
        with db_factory() as session, session.begin():
            user = User(email=f"phase2-{uuid4().hex}@example.com", password_hash=password_hash,
                        role=role, is_active=active)
            session.add(user)
            session.flush()
            if role == UserRole.CUSTOMER:
                session.add(CustomerProfile(id=user.id))
                session.flush()
            return UserResponse.model_validate(user)
    return create


@pytest.fixture
def login_headers(client, password):
    def headers(user):
        response = client.post("/api/v1/auth/login", json={"email": user.email, "password": password})
        if response.status_code != 200:
            pytest.fail("Fixture login failed; response intentionally omitted")
        return {"Authorization": "Bearer " + response.json()["access_token"]}
    return headers
