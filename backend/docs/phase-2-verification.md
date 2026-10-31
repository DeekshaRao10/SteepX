# Phase 2 verification report

Historical report: results and limitations below describe the Phase 2 delivery.
The [Phases 3–8 report](phase-3-to-8-verification.md) records subsequent regression
results, the local JWT fix, development migrations, demo support, and documentation
ignore-rule corrections. The original Phase 2 counts and observations are retained.

## Observed result

Final full automated run: **119 passed, 0 failed, 0 skipped in 16.07 seconds**.
Real loopback HTTP verification: **14 checks passed** using a separately launched
Uvicorn process and the preserved main:app entry point. That process was stopped.
The HTTP helper then observed **users=0 and auth_sessions=0** in the isolated database.

These are observed results, not a general security guarantee. The user previously
reported that Phase 1 startup and health worked; no other historical checks were
assumed to have passed.

## Environment and target confirmation

- Windows PowerShell, project backend directory C:\Programming\SteepX\backend.
- Python 3.12.2; existing virtual environment.
- Installed versions inspected: FastAPI 0.162.0, SQLAlchemy 2.1.6, Alembic 1.20.1,
  Psycopg 3.3.6, Pydantic 2.14.2, Pydantic Settings 2.16.2, PyJWT 2.15.1,
  pwdlib 0.3.1, Argon2-cffi 25.1.0, pytest 9.2.0, HTTPX 0.28.1.
- No dependencies were installed, removed, or upgraded; requirements.txt is unchanged.
- Docker inspection confirmed postgres:17 running with container port 5432 bound
  to 127.0.0.1:5433.
- Before database changes, a read-only connection checked the configured database
  and user against the existing local project configuration, server port, PostgreSQL
  major version, and recovery state. Credentials and database identifiers were not printed.
- A new dedicated database with a generated steepx_phase2_test_ name and an ownership
  comment was created. Only its name was saved in backend/tmp/phase2-test-target.json.
- PostgreSQL integration and HTTP checks used that verified, marked test database.
  There was no SQLite or mocked-database substitute for integration coverage.
- The existing development database received read-only identity checks only. Its
  existing user data and schema were not changed. No database was dropped, reset,
  truncated, or recreated; no Docker volume was deleted.
- Existing real application configuration failed validation specifically at
  JWT_SECRET_KEY. Its value was not exposed or changed. Tests and the HTTP server
  used fresh generated signing keys in memory.

## Commands actually executed

Read-only container checks from the project directory:

```powershell
docker inspect --format '{{json .NetworkSettings.Ports}}' brightloop-postgres
docker inspect --format '{{.Config.Image}} {{.State.Running}}' brightloop-postgres
```

The first Docker inspection was blocked by sandbox permissions; it was rerun with
approved access and succeeded. An initial inline Python metadata probe failed due
to PowerShell quoting; the dedicated inspection module replaced it successfully.
Neither failure executed tests or changed database data.

Backend commands, exactly as invoked:

```powershell
& .\.venv\Scripts\python.exe -m scripts.inspect_local_db
& .\.venv\Scripts\python.exe -m pytest -q
& .\.venv\Scripts\python.exe -m scripts.prepare_test_database
& .\.venv\Scripts\python.exe -m pytest -q --run-db
& .\.venv\Scripts\python.exe -m scripts.verify_phase2_http
```

Inspection and the full suite were repeated as described below. Commands did not
contain passwords, database credentials, JWT secrets, or tokens. File reads/searches
and backend edits were also performed. No Git command was run.

## Automated runs and actual outcomes

| Run | Outcome | Reason for subsequent work |
| --- | --- | --- |
| Initial pytest -q | 60 passed, 45 skipped in 1.46s | Database integration is opt-in; the isolated target was not prepared yet. |
| First pytest -q --run-db | 105 passed in 15.29s | Added identity-selection, request-cleanup, unsigned-token, and CLI guard checks. |
| Expanded pytest -q --run-db | 109 passed in 16.04s | Added concurrent bootstrap and local-tool safety coverage. |
| Pre-review pytest -q --run-db | 116 passed in 16.11s | Added explicit IDNA normalization and duplicate-domain coverage after file review. |
| Final pytest -q --run-db | 119 passed in 16.07s | All current automated tests passed; no skips. |

There were no automated test failures. No pre-existing test suite was present
before Phase 2; the full command includes the newly added Phase 1 regression checks.
Assertions use plain output and short tracebacks to avoid echoing runtime credential
values in failure reports.

## Executed coverage checklist

| Area | Observed outcome |
| --- | --- |
| Valid registration, Argon2 hashing, safe response | Passed |
| Password length/class boundaries | Passed |
| Invalid/missing email or credentials, malformed JSON, extra fields | Passed |
| Admin/staff/customer role injection through registration | Passed: rejected |
| Duplicate email with case/whitespace and Unicode/ASCII domain normalization | Passed |
| Concurrent duplicate registration | Passed: one 201, one 409, one stored account |
| Successful login and safe token response headers | Passed |
| Wrong password, unknown email, disabled-account login | Passed: identical 401 response |
| Missing/malformed/unsigned/invalid-signature/expired/future/invalid-claim tokens | Passed |
| Missing or invalid JWT configuration and unsupported algorithms | Passed: refused |
| /auth/me and server-derived identity | Passed; supplied user_id did not select another account |
| Account disabled or role changed after token issuance | Passed: subsequent requests recheck the database |
| Logout revocation and independent sessions | Passed |
| Admin/staff/customer policy combinations | Passed using test-confined routes/dependencies |
| Admin-only staff creation and role injection prevention | Passed |
| Public admin/bootstrap HTTP paths | Passed: absent/404 |
| Bootstrap first-admin rule and refusal to promote an existing customer | Passed |
| Concurrent bootstrap | Passed: exactly one admin created, second refused |
| Noninteractive bootstrap CLI | Passed: refused before accessing credentials |
| Database uniqueness, normalized-email and role constraints | Passed against PostgreSQL |
| Transaction rollback and request cleanup of unfinished work | Passed |
| Migration upgrade, repeat upgrade, and model agreement | Passed |
| Health compatibility, OpenAPI, CORS, safe 404/405/500 handling | Passed |
| Environment override order and unsafe local target rejection | Passed |
| Local key helper preserving other content, refusing replacement/overrides | Passed in isolated temporary files |
| Exception traceback suppression and sensitive response-field exclusions | Passed for exercised cases |

## Real HTTP checks

The helper launched its own hidden local Uvicorn process with main:app, an available
loopback port, the verified test database, and a temporary signing key passed only
through the child environment. It performed these 14 successful status checks:

1. Health GET: 200 with the preserved response.
2. OpenAPI GET: 200.
3. Customer registration: 201.
4. Duplicate registration: 409.
5. Registration role injection: 422.
6. Customer login: 200.
7. Authenticated current user: 200.
8. Current user without a token: 401.
9. Current user with a malformed token: 401.
10. Customer attempting staff creation: 403.
11. Login for an explicitly bootstrapped test admin: 200.
12. Admin creating test staff: 201.
13. Logout: 204.
14. Current user with the revoked token: 401.

The bootstrap service was explicitly invoked inside this test helper against the
empty marked database, not through HTTP or startup. Response bodies and credentials
were not printed. Only this run's generated emails and associated sessions were
removed afterward. The helper was rerun after the final automated suite; each HTTP
run reported 14 passing checks and zero remaining users/login sessions afterward.

## Schema and migration review

Revision 20261101_01 was authored and read before execution. Its upgrade contains
only table/index creation: users, auth_sessions, unique normalized email, role and
date constraints, user foreign key, and session user/expiry indexes. It has no
seed data, existing-record updates, table drops, or destructive recreation.

The suite applied it through Alembic to the confirmed isolated test connection,
repeated upgrade head, checked the stored revision, and ran Alembic command.check
for model agreement. No migration was applied to the existing development database.
The downgrade deliberately refuses execution to avoid accidental loss of auth data.

## Necessary foundation changes

- Added strict JWT settings while separating database-only configuration, allowing
  migration/bootstrap tools to operate without a signing secret.
- Added a PublicError path and curated password/email validation messages so clients
  receive useful errors without exposing raw exception/input data.
- Moved the reusable app factory to app/application.py to isolate test settings;
  backend/main.py and app/main.py preserve startup compatibility.
- Added a programmatic Alembic connection override for an already verified isolated
  test target. Normal CLI behavior still uses configured database settings.
- File review found that EmailStr could convert the normalized ASCII domain back
  to Unicode. The schema now uses the explicit normalization validator with an
  email-formatted string schema; added tests cover equivalent domain spellings and
  rejection of internationalized local parts.

## Files created or changed

| Files | Purpose |
| --- | --- |
| app/core/config.py, errors.py; app/db/session.py | Extended settings, safe errors, shared database configuration |
| app/application.py (new), app/main.py | Testable factory and compatible startup |
| app/core/security.py, permissions.py (new) | Argon2, JWT validation, role policies |
| app/models/user.py, auth_session.py (new); app/models/__init__.py | User and revocable session metadata |
| app/schemas/auth.py (new) | Credential validation and safe response schemas |
| app/services/__init__.py, auth.py (new) | Explicit transactional account/auth/bootstrap operations |
| app/dependencies/__init__.py, auth.py (new) | Request settings and current-user dependency |
| app/api/v1/endpoints/auth.py, staff.py (new); app/api/v1/api.py | Authentication/staff routes and registration |
| migrations/env.py; migrations/versions/20261101_01_auth.py (new) | Shared DB settings, connection override, additive auth migration |
| scripts/__init__.py, local_database.py, inspect_local_db.py (new) | Explicit local tooling and target safety |
| scripts/bootstrap_admin.py, configure_local_jwt.py, migrate_local.py (new) | Secure local administrative setup |
| scripts/prepare_test_database.py, verify_phase2_http.py (new) | Isolated PostgreSQL and live HTTP verification |
| pytest.ini; tests/conftest.py, test_security.py, test_regression.py, test_auth_integration.py, test_local_tools.py (new) | Automated coverage |
| backend/.env.example | JWT environment reference; no real secret |
| README.md, docs/api.md, docs/manual-verification.md | Updated setup, contract, and manual instructions |
| docs/phase-2-verification.md (new) | This report |
| tmp/phase2-test-target.json (generated, ignored) | Local test database name only; no credentials |

No frontend or shared root files were changed. Existing dependency pins and the
backend/main.py compatibility entry point were preserved. Root .gitignore currently
ignores the backend README/docs; their local updates will require a separate review
of those ignore entries if they should be tracked.

## Remaining setup, skipped scope, and limitations

- All final automated tests ran; no final suite skip remains. The initial default
  run intentionally skipped integration until the dedicated target was prepared.
- Fix the local JWT_SECRET_KEY before running the normal backend. Real environment
  files have not been changed. The backend-only key helper is documented and tested
  using temporary files; it has not been run against real configuration.
- Apply the reviewed migration to your confirmed local development database using
  scripts.migrate_local, then deliberately bootstrap the first real local admin.
  Neither real development migration nor real admin creation was executed here.
- The interactive terminal password-entry experience was not driven end to end.
  Bootstrap service behavior/concurrency and the noninteractive refusal were tested.
- No production/external gateway/email access, frontend integration, or browser UI
  verification occurred. None is claimed.
- Public deployment still needs HTTPS, a managed signing secret, abuse/rate controls,
  and email verification. Registration's conflict status reveals email availability.
- No refresh tokens, password-reset delivery, account-edit/disable API, granular
  staff permissions, or session-retention job is implemented. Reset design is
  documented as future work without claiming delivery.
- Ownership policies for future business resources are documented, but no ownership
  security is claimed for resources that do not exist yet.
- Demo seeding is not implemented. No default accounts or demo records appear at
  startup; the separate admin bootstrap is not a demo-data command.
- Test database/schema are deliberately retained. No destructive cleanup command
  was run or supplied. Only test-created records were cleaned up.
- Phase 3 and all product/billing work remain unimplemented.
