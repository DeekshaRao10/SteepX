"""Opt-in real HTTP smoke check against only the marked Phase 2 test database."""

import os
import secrets
import socket
import subprocess
import sys
import time
from uuid import uuid4

import httpx
from sqlalchemy import delete, func, select

from app.core.config import BACKEND_DIR
from app.db.session import create_session_factory
from app.models import AuthSession, User
from app.models.catalog import CustomerProfile
from app.schemas.auth import RegisterRequest
from app.services.auth import bootstrap_admin
from scripts.local_database import confirmed_engine, test_database_name


def main() -> int:
    engine = confirmed_engine(test_name=test_database_name())
    factory = create_session_factory(engine)
    run_id = uuid4().hex
    emails = [f"http-{run_id}-{kind}@example.com" for kind in ("customer", "admin", "staff")]
    password = "Aa!" + secrets.token_urlsafe(24)
    process = None
    checks = 0

    def expect(response, status):
        nonlocal checks
        if response.status_code != status:
            raise RuntimeError("Unexpected HTTP status; response omitted to protect credentials.")
        checks += 1
        return response

    try:
        with factory() as session, session.begin():
            if session.scalar(select(func.count()).select_from(User)):
                raise RuntimeError("Smoke verification requires an empty marked test database.")
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        environment = dict(os.environ)
        environment.update(
            DATABASE_URL=engine.url.render_as_string(hide_password=False),
            JWT_SECRET_KEY=secrets.token_urlsafe(48), JWT_ALGORITHM="HS256",
        )
        process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1",
             "--port", str(port), "--no-access-log"],
            cwd=BACKEND_DIR, env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=10, trust_env=False) as client:
            ready = False
            for _ in range(100):
                if process.poll() is not None:
                    break
                try:
                    response = client.get("/api/v1/health")
                    if response.status_code == 200:
                        ready = True
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.1)
            if not ready:
                raise RuntimeError("Local verification server did not become ready.")
            expect(response, 200)
            assert response.json() == {"status": "ok", "service": "Brightloop Subscription API"}
            expect(client.get("/openapi.json"), 200)
            body = {"email": emails[0], "password": password}
            expect(client.post("/api/v1/auth/register", json=body), 201)
            expect(client.post("/api/v1/auth/register", json=body), 409)
            expect(client.post("/api/v1/auth/register", json=body | {"role": "admin"}), 422)
            login = expect(client.post("/api/v1/auth/login", json=body), 200)
            headers = {"Authorization": "Bearer " + login.json()["access_token"]}
            expect(client.get("/api/v1/auth/me", headers=headers), 200)
            expect(client.get("/api/v1/auth/me"), 401)
            expect(client.get("/api/v1/auth/me", headers={"Authorization": "Bearer malformed"}), 401)
            expect(client.post("/api/v1/staff", headers=headers, json={"email": emails[2], "password": password}), 403)
            with factory() as session:
                bootstrap_admin(session, RegisterRequest(email=emails[1], password=password))
            admin_login = expect(client.post("/api/v1/auth/login", json={"email": emails[1], "password": password}), 200)
            admin_headers = {"Authorization": "Bearer " + admin_login.json()["access_token"]}
            expect(client.post("/api/v1/staff", headers=admin_headers, json={"email": emails[2], "password": password}), 201)
            expect(client.post("/api/v1/auth/logout", headers=headers), 204)
            expect(client.get("/api/v1/auth/me", headers=headers), 401)
        print(f"Real HTTP verification: {checks} checks passed; credentials and responses omitted.")
        return 0
    except Exception as exc:
        print("Real HTTP verification failed (" + type(exc).__name__ + "); sensitive details omitted.")
        return 1
    finally:
        if process is not None:
            process.terminate()
            try:
                process.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
        # Exact unique emails belong to this run in an independently verified test DB.
        with factory() as session, session.begin():
            user_ids = list(session.scalars(select(User.id).where(User.email.in_(emails))))
            if user_ids:
                session.execute(delete(AuthSession).where(AuthSession.user_id.in_(user_ids)))
                session.execute(delete(CustomerProfile).where(CustomerProfile.id.in_(user_ids)))
                session.execute(delete(User).where(User.id.in_(user_ids)))
            users = session.scalar(select(func.count()).select_from(User))
            sessions = session.scalar(select(func.count()).select_from(AuthSession))
        engine.dispose()
        print(f"Remaining isolated records: users={users}, auth_sessions={sessions}. Local verification process stopped.")


if __name__ == "__main__":
    raise SystemExit(main())
