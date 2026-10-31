"""Create a new, marked local test database. Never drops or reuses databases."""

import json
import secrets

from sqlalchemy import text

from scripts.local_database import TARGET_FILE, TEST_MARKER, confirmed_engine


def main() -> int:
    engine = None
    try:
        engine = confirmed_engine()
        name = "steepx_phase2_test_" + secrets.token_hex(6)
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
            # Name is internally generated hex, never supplied by a user.
            connection.execute(text(f'CREATE DATABASE "{name}"'))
            connection.execute(text(f"COMMENT ON DATABASE \"{name}\" IS '{TEST_MARKER}'"))
        TARGET_FILE.parent.mkdir(parents=True, exist_ok=True)
        TARGET_FILE.write_text(json.dumps({"database": name}) + "\n", encoding="utf-8")
        print("Created a fresh marked local test database; target name saved in backend/tmp/phase2-test-target.json.")
        print("No existing records were changed. The test database will not be dropped automatically.")
        return 0
    except Exception as exc:
        print("Test database preparation failed (" + type(exc).__name__ + "); details omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
