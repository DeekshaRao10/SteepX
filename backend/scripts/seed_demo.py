"""Seed only the explicitly selected isolated demo database, never normal startup."""
import argparse

from app.core.config import get_settings
from app.services.demo import seed_demo
from scripts.demo_credentials import prepare_credentials
from scripts.local_database import confirmed_engine, demo_database_name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["isolated-demo"])
    parser.parse_args()
    engine = None
    try:
        name = demo_database_name()
        engine = confirmed_engine(demo_name=name)
        credentials = prepare_credentials(name)
        records, created = seed_demo(engine, get_settings(), credentials["accounts"])
        print("Demo records created atomically." if created else "Existing demo seed retained; no records overwritten or duplicated.")
        print("Record counts: " + ", ".join(f"{kind}={len(ids)}" for kind, ids in records.items()))
        print("Local credentials: backend/tmp/demo-credentials.json (ignored; never publish). No data deleted.")
        return 0
    except Exception as error:
        print(f"Demo seed refused ({type(error).__name__}); details omitted. No reset attempted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
