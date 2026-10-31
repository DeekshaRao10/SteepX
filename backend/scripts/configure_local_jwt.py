"""Explicitly add a generated backend-only signing secret without exposing it."""

import os
import secrets

from dotenv import dotenv_values

from app.core.config import BACKEND_DIR


def main() -> int:
    target = BACKEND_DIR / ".env"
    if "JWT_SECRET_KEY" in os.environ:
        print("A process JWT_SECRET_KEY override is set; review it before creating a file override.")
        return 1
    if target.exists() and "JWT_SECRET_KEY" in dotenv_values(target):
        print("Backend .env already defines JWT_SECRET_KEY; refusing to replace it.")
        return 1
    secret = secrets.token_urlsafe(48)
    # Append only the one missing key; preserve all existing configuration.
    with target.open("a", encoding="utf-8") as stream:
        stream.write("\n# Generated local signing key; keep this file private.\nJWT_SECRET_KEY=" + secret + "\n")
    print("Generated a backend-only JWT signing key. Root .env was not changed; no secret was displayed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
