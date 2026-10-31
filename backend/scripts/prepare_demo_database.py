"""Create or reuse only a marked isolated demo target; no data reset."""
import argparse
import json
import secrets

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.config import BACKEND_DIR
from scripts.local_database import DEMO_MARKER, DEMO_TARGET_FILE, confirmed_engine, demo_database_name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["isolated-demo"])
    parser.parse_args()
    engine = None
    try:
        if not DEMO_TARGET_FILE.exists():
            engine = confirmed_engine()
            name = "steepx_demo_" + secrets.token_hex(6)
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
                connection.execute(text(f'CREATE DATABASE "{name}"'))
                connection.execute(text(f"COMMENT ON DATABASE \"{name}\" IS '{DEMO_MARKER}'"))
            engine.dispose()
            DEMO_TARGET_FILE.parent.mkdir(parents=True, exist_ok=True)
            with DEMO_TARGET_FILE.open("x", encoding="utf-8") as output:
                json.dump({"database": name}, output)
        engine = confirmed_engine(demo_name=demo_database_name())
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        with engine.connect() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            command.check(config)
        print("Marked isolated demo database ready; migrations match models. Existing records retained.")
        return 0
    except Exception as error:
        print(f"Demo preparation failed ({type(error).__name__}); details omitted. No reset attempted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
