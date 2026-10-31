"""Explicit opt-in demo seeding on a verified local target, never normal startup."""
import argparse
import json

from sqlalchemy import select, text

from app.core.config import get_settings
from app.services.demo import seed_demo
from scripts.demo_credentials import prepare_credentials
from scripts.local_database import confirmed_engine, demo_database_name


def seed_development(engine):
    from app.models.user import User
    from app.services.development_demo import ACCOUNT_SPECS, select_existing_admin, seed_development_demo
    from scripts.development_demo_credentials import CREDENTIAL_FILE, prepare_credentials as prepare_development_credentials

    with engine.connect() as connection, connection.begin():
        # Serialize credential initialization as well as the subsequent seed transaction.
        connection.execute(text("SELECT pg_advisory_xact_lock(731902213)"))
        from sqlalchemy.orm import Session
        with Session(bind=connection, autobegin=False, join_transaction_mode="create_savepoint") as session, session.begin():
            admin = select_existing_admin(session)
            admin_email = admin.email
            existing = {user.email: user.role.value for user in session.scalars(select(User).where(
                User.email.in_([spec["email"] for spec in ACCOUNT_SPECS.values()])))}
            for spec in ACCOUNT_SPECS.values():
                if spec["email"] in existing and existing[spec["email"]] != spec["role"]:
                    from app.services.development_demo import DemoSeedError
                    raise DemoSeedError("A demo email belongs to another role; no privileges were changed.")
        credentials = prepare_development_credentials(engine.url.database, ACCOUNT_SPECS, existing, admin_email)
        records, changes = seed_development_demo(engine, get_settings(), credentials["accounts"])
    print("Confirmed target: local development database; existing accounts and records preserved.")
    print("Administrator reused: " + admin_email)
    if admin_email != "admin.demo@example.com":
        print("admin.demo@example.com was not created: the supported bootstrap creates only the first administrator.")
    print(json.dumps({"records": {key: len(ids) for key, ids in records.items()}, **changes}, sort_keys=True))
    print("Generated passwords are encrypted for your Windows account in backend/tmp/development-demo-credentials.json (ignored).")
    print("Retrieve privately: python -m scripts.development_demo_credentials --account staff --copy-password")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["isolated-demo", "development"])
    args = parser.parse_args()
    engine = None
    try:
        if args.target == "development":
            engine = confirmed_engine()
            return seed_development(engine)
        name = demo_database_name()
        engine = confirmed_engine(demo_name=name)
        credentials = prepare_credentials(name)
        records, created = seed_demo(engine, get_settings(), credentials["accounts"])
        print("Demo records created atomically." if created else "Existing demo seed retained; no records overwritten or duplicated.")
        print("Record counts: " + ", ".join(f"{kind}={len(ids)}" for kind, ids in records.items()))
        print("Local credentials: backend/tmp/demo-credentials.json (ignored; never publish). No data deleted.")
        return 0
    except Exception as error:
        from app.services.development_demo import DemoSeedError
        if isinstance(error, DemoSeedError):
            print(str(error))
        else:
            print(f"Demo seed refused ({type(error).__name__}); details omitted. No reset attempted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
