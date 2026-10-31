"""Explicit additive migration of the confirmed local development database."""

from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_DIR
from scripts.local_database import confirmed_engine


def main() -> int:
    engine = None
    try:
        engine = confirmed_engine()
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        with engine.connect() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
        print("Local migration command completed; credentials omitted.")
        return 0
    except Exception as exc:
        print("Local migration failed (" + type(exc).__name__ + "); no destructive recovery was attempted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
