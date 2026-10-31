"""Read-only Alembic revision/model check after confirming the local target."""
import argparse

from alembic import command
from alembic.config import Config

from app.core.config import BACKEND_DIR
from scripts.local_database import confirmed_engine, demo_database_name, test_database_name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["development", "isolated-test", "isolated-demo"])
    args = parser.parse_args()
    engine = None
    try:
        options = {"test_name": test_database_name()} if args.target == "isolated-test" else {"demo_name": demo_database_name()} if args.target == "isolated-demo" else {}
        engine = confirmed_engine(**options)
        config = Config(str(BACKEND_DIR / "alembic.ini"))
        with engine.connect() as connection:
            config.attributes["connection"] = connection
            command.current(config)
            command.check(config)
        print("Confirmed local target: migration revision and model check completed. No schema/data mutation requested.")
        return 0
    except Exception as error:
        print(f"Migration check failed ({type(error).__name__}); credentials omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
