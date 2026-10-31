"""Explicit, interactive first-admin creation on the confirmed local database."""

import getpass
import sys

from pydantic import ValidationError

from app.core.errors import PublicError
from app.db.session import create_session_factory
from app.schemas.auth import RegisterRequest
from app.services.auth import bootstrap_admin
from scripts.local_database import confirmed_engine


def main() -> int:
    if not sys.stdin.isatty():
        print("Bootstrap requires an interactive terminal; credentials cannot be supplied as command arguments.")
        return 1
    engine = None
    try:
        engine = confirmed_engine()
        print("Confirmed local development database. This command creates only the first administrator.")
        if input("Type CREATE FIRST ADMIN to continue: ") != "CREATE FIRST ADMIN":
            print("Cancelled; no account created.")
            return 1
        email = input("Admin email: ")
        password = getpass.getpass("Admin password (hidden): ")
        if password != getpass.getpass("Confirm password (hidden): "):
            print("Passwords did not match; no account created.")
            return 1
        data = RegisterRequest(email=email, password=password)
        with create_session_factory(engine)() as session:
            bootstrap_admin(session, data)
        print("First administrator created. Credentials are not displayed.")
        return 0
    except ValidationError:
        print("Invalid email or password. Use 9–128 characters, uppercase, lowercase, and a special character.")
        return 1
    except PublicError as exc:
        print(exc.message)
        return 1
    except (EOFError, KeyboardInterrupt):
        print("Cancelled.")
        return 1
    except Exception as exc:
        print("Bootstrap failed (" + type(exc).__name__ + "); check local configuration and migrations.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
