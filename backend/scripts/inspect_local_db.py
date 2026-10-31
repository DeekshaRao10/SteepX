"""Read-only dependency and local database audit; emits no settings values."""

import importlib.metadata
import platform

from pydantic import ValidationError
from pydantic_settings import SettingsError

from app.core.config import Settings
from scripts.local_database import confirmed_engine


def main() -> int:
    print("Python " + platform.python_version())
    for name in ("fastapi", "SQLAlchemy", "alembic", "psycopg", "pydantic", "pydantic-settings",
                 "PyJWT", "pwdlib", "argon2-cffi", "pytest", "httpx"):
        print(name + "==" + importlib.metadata.version(name))
    try:
        Settings()
        print("JWT configuration: valid (values omitted).")
    except ValidationError as exc:
        invalid_fields = sorted({error["loc"][0] for error in exc.errors()
                                 if error["loc"] and error["loc"][0] in Settings.model_fields})
        print("Invalid configuration fields: " + ", ".join(name.upper() for name in invalid_fields) + " (values omitted).")
    except SettingsError:
        print("JWT/application configuration: invalid; repair required (values omitted).")
    try:
        engine = confirmed_engine()
        engine.dispose()
        print("Read-only identity check: confirmed intended local PostgreSQL 17 development database.")
    except Exception as exc:
        print("Local database identity check failed (" + type(exc).__name__ + "); details omitted.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
