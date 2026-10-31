"""Separate explicit first-admin bootstrap, confined to the marked demo target."""
import argparse

from sqlalchemy import select

from app.db.session import create_session_factory
from app.core.security import verify_password
from app.models.user import User, UserRole
from app.schemas.auth import RegisterRequest
from app.services.auth import bootstrap_admin
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
        data = prepare_credentials(name)["accounts"]["admin"]
        with create_session_factory(engine)() as session:
            with session.begin():
                existing = session.scalar(select(User).where(User.email == data["email"]))
                if existing:
                    if existing.role != UserRole.ADMIN or not existing.is_active or not verify_password(data["password"], existing.password_hash):
                        raise RuntimeError("Demo admin identity mismatch; no account was changed.")
                    print("Existing demo administrator retained; no privileges changed.")
                    return 0
            bootstrap_admin(session, RegisterRequest(**data))
        print("Demo administrator explicitly bootstrapped. Credentials are in backend/tmp/demo-credentials.json; never publish it.")
        return 0
    except Exception as error:
        print(f"Demo bootstrap refused ({type(error).__name__}); sensitive details omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
