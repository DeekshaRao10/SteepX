"""Shared safety checks for local administrative and isolated test commands."""

import json
import re

from dotenv import dotenv_values
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import URL, make_url

from app.core.config import BACKEND_DIR, PROJECT_DIR, get_database_settings

TEST_MARKER = "SteepX isolated Phase 2 test database"
TARGET_FILE = BACKEND_DIR / "tmp" / "phase2-test-target.json"
TEST_NAME = re.compile(r"steepx_phase2_test_[0-9a-f]{12}\Z")
DEMO_NAME = re.compile(r"steepx_demo_[0-9a-f]{12}\Z")
DEMO_MARKER = "SteepX isolated local demo database"
DEMO_TARGET_FILE = BACKEND_DIR / "tmp" / "demo-target.json"


class LocalDatabaseError(RuntimeError):
    pass


def local_url(*, test_name: str | None = None, demo_name: str | None = None) -> URL:
    settings = get_database_settings()
    url = make_url(settings.database_url.get_secret_value())
    root = dotenv_values(PROJECT_DIR / ".env")
    if (
        url.drivername != "postgresql+psycopg"
        or url.host not in {"127.0.0.1", "localhost", "::1"}
        or url.query
        or url.port != int(root.get("POSTGRES_PORT") or "5433")
        or url.database != root.get("POSTGRES_DB")
        or url.username != root.get("POSTGRES_USER")
    ):
        raise LocalDatabaseError("Target does not match the project's local development database.")
    if test_name is not None:
        if not TEST_NAME.fullmatch(test_name):
            raise LocalDatabaseError("Refusing an unrecognized test database name.")
        url = url.set(database=test_name)
    if demo_name is not None:
        if test_name is not None or not DEMO_NAME.fullmatch(demo_name):
            raise LocalDatabaseError("Refusing an unrecognized demo database name.")
        url = url.set(database=demo_name)
    return url


def confirmed_engine(*, test_name: str | None = None, demo_name: str | None = None) -> Engine:
    url = local_url(test_name=test_name, demo_name=demo_name)
    engine = create_engine(url, echo=False, hide_parameters=True, connect_args={"connect_timeout": 5})
    try:
        with engine.connect() as connection:
            row = connection.execute(text(
                "SELECT current_database(), current_user, inet_server_port(), "
                "current_setting('server_version_num')::integer, pg_is_in_recovery()"
            )).one()
            if (row[0] != url.database or row[1] != url.username or row[2] != 5432
                    or row[3] // 10000 != 17 or row[4]):
                raise LocalDatabaseError("Connected server does not match the expected local PostgreSQL server.")
            if test_name is not None or demo_name is not None:
                marker = connection.scalar(text(
                    "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()"
                ))
                if marker != (DEMO_MARKER if demo_name else TEST_MARKER):
                    raise LocalDatabaseError("Test database ownership marker is missing; refusing changes.")
    except Exception:
        engine.dispose()
        raise
    return engine


def test_database_name() -> str:
    try:
        name = json.loads(TARGET_FILE.read_text(encoding="utf-8"))["database"]
    except (OSError, ValueError, KeyError):
        raise LocalDatabaseError("Run the explicit prepare_test_database command first.") from None
    if not isinstance(name, str) or not TEST_NAME.fullmatch(name):
        raise LocalDatabaseError("Invalid local test target manifest.")
    return name


def demo_database_name() -> str:
    try:
        name = json.loads(DEMO_TARGET_FILE.read_text(encoding="utf-8"))["database"]
    except (OSError, ValueError, KeyError):
        raise LocalDatabaseError("Run prepare_demo_database --target isolated-demo first.") from None
    if not isinstance(name, str) or not DEMO_NAME.fullmatch(name):
        raise LocalDatabaseError("Invalid local demo target manifest.")
    return name
