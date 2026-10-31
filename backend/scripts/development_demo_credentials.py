"""Private development-demo credentials, encrypted for the current Windows user."""
import argparse
import base64
import ctypes
import json
import os
from pathlib import Path
import secrets
import subprocess

from app.core.config import BACKEND_DIR
from scripts.local_database import LocalDatabaseError, confirmed_engine

CREDENTIAL_FILE = BACKEND_DIR / "tmp" / "development-demo-credentials.json"


def _windows_protect(value: bytes, *, decrypt=False) -> bytes:
    if os.name != "nt":
        raise LocalDatabaseError("This private credential store requires Windows DPAPI.")
    from ctypes import wintypes

    class Blob(ctypes.Structure):
        _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(value)
    source = Blob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if decrypt:
        operation = crypt.CryptUnprotectData
        operation.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                              ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        description = None
    else:
        operation = crypt.CryptProtectData
        operation.argtypes = [ctypes.POINTER(Blob), wintypes.LPCWSTR, ctypes.c_void_p,
                              ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
        description = "SteepX local development demo credentials"
    operation.restype = wintypes.BOOL
    if not operation(ctypes.byref(source), description, None, None, None, 1, ctypes.byref(target)):
        raise LocalDatabaseError("Private credential protection failed; values omitted.")
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(target.data)


def load_credentials(database: str, path: Path = CREDENTIAL_FILE) -> dict:
    envelope = json.loads(path.read_text(encoding="utf-8"))
    if envelope.get("database") != database or envelope.get("protection") != "windows-dpapi":
        raise LocalDatabaseError("Credential file does not match this development target.")
    return json.loads(_windows_protect(base64.b64decode(envelope["payload"]), decrypt=True))


def prepare_credentials(database: str, specifications: dict, existing: dict, admin_email: str) -> dict:
    if CREDENTIAL_FILE.exists():
        data = load_credentials(database)
        if data["accounts"]["admin"]["email"] != admin_email:
            raise LocalDatabaseError("Existing credential metadata names another administrator; no changes made.")
        for key, specification in specifications.items():
            if data["accounts"].get(key, {}).get("email") != specification["email"]:
                raise LocalDatabaseError("Existing demo credential definitions differ; refusing replacement.")
        return data
    accounts = {"admin": {"email": admin_email, "role": "admin", "existing": True}}
    for key, specification in specifications.items():
        email = specification["email"]
        accounts[key] = {"email": email, "role": specification["role"], "existing": email in existing}
        if email not in existing:
            accounts[key]["password"] = "Aa!" + secrets.token_urlsafe(32)
    data = {"accounts": accounts}
    envelope = {"version": 1, "database": database, "protection": "windows-dpapi",
                "payload": base64.b64encode(_windows_protect(json.dumps(data).encode())).decode()}
    CREDENTIAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(CREDENTIAL_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        json.dump(envelope, output, indent=2)
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="List aliases and emails, never passwords")
    parser.add_argument("--account", help="Account alias, e.g. staff or customer")
    parser.add_argument("--copy-password", action="store_true", help="Copy one generated password to the local clipboard")
    args = parser.parse_args()
    engine = None
    try:
        engine = confirmed_engine()
        accounts = load_credentials(engine.url.database)["accounts"]
        if args.list:
            for alias, account in accounts.items():
                print(f"{alias}: {account['email']} ({account['role']}; " +
                      ("generated password available" if "password" in account else "use existing password") + ")")
            return 0
        if not args.account or not args.copy_password:
            parser.error("Use --list, or --account ALIAS --copy-password.")
        account = accounts.get(args.account)
        if not account or "password" not in account:
            print("No generated password is stored for this account. Use its existing password; none was changed.")
            return 1
        subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                        "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
                       input=account["password"], text=True, capture_output=True, check=True)
        print("Password copied to your local clipboard. Paste it into the login form, then clear the clipboard.")
        return 0
    except Exception as error:
        print(f"Private credential access failed ({type(error).__name__}); sensitive details omitted.")
        return 1
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
