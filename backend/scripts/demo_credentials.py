"""Local-only generated credentials. Never print their values."""
import json
import os
import secrets

from app.core.config import BACKEND_DIR
from scripts.local_database import LocalDatabaseError

CREDENTIAL_FILE = BACKEND_DIR / "tmp" / "demo-credentials.json"


def prepare_credentials(database):
    if CREDENTIAL_FILE.exists():
        data = json.loads(CREDENTIAL_FILE.read_text(encoding="utf-8"))
        if data.get("database") != database:
            raise LocalDatabaseError("Credential file belongs to another demo target; refusing replacement.")
        return data
    data = {"database": database, "warning": "LOCAL DEMO ONLY. Never use in production or publish this file.",
        "accounts": {role: {"email": f"demo-{role}@example.com", "password": "Aa!" + secrets.token_urlsafe(24)}
                     for role in ("admin", "staff", "customer1", "customer2", "customer3")}}
    CREDENTIAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(CREDENTIAL_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        json.dump(data, output, indent=2)
    return data
