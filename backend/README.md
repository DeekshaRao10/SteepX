# SteepX backend — Phases 1–8

The backend implements authentication, customer profiles, catalog, quotations,
subscriptions, invoices, taxes, discounts, manual payments, finance reports, and
explicit isolated demo data. See [current verification](docs/phase-3-to-8-verification.md),
[business rules](docs/business-rules.md), and [historical Phase 2 results](docs/phase-2-verification.md).

## Architecture

- main.py preserves the `uvicorn main:app` entry point.
- app/main.py constructs the application; app/application.py exposes a factory so
  tests can supply isolated settings without importing real application configuration.
- app/api/v1 contains thin HTTP handlers under /api/v1.
- app/schemas defines explicit input/output contracts; password hashes are never output.
- app/services owns explicit transactions for authentication and business operations.
  pricing.py and core/billing_dates.py centralize decimal calculations and anchored dates.
- app/dependencies/auth.py and app/core/permissions.py provide reusable authentication
  and explicit role allowlists. There are no production demonstration routes.
- app/db provides the SQLAlchemy base, timestamps, synchronous Psycopg engine, and
  request-scoped sessions. app/models imports models for Alembic discovery.
- migrations contains five additive revisions, ending at 20261101_05.
  Existing customer accounts receive missing profiles without changing their credentials.
- scripts contains explicit local administrative and verification commands.
- tests contains unit, API regression, PostgreSQL integration, and local-tool checks.

Dependency versions in requirements.txt were reused unchanged. No installation or
upgrade was performed. Python 3.12.2 and the required installed packages were inspected.

## Environment configuration

Source priority, highest first:

1. Process environment variables.
2. Optional backend/.env.
3. Existing project-root .env.
4. Defaults in app/core/config.py.

Paths are resolved from the module location, independently of the current directory.
Names are case-insensitive. Settings are cached; restart the backend after changing
them. The example file is not loaded automatically. Do not copy the complete root
.env or print its contents. Unknown shared frontend settings are ignored.

| Variable | Default / requirement |
| --- | --- |
| DATABASE_URL | Required; PostgreSQL URL using postgresql+psycopg and a database name. Reuse the existing root value. |
| CORS_ORIGINS | JSON array, default ["http://localhost:3000"]. Exact HTTP(S) origins; no wildcards, paths, credentials, or trailing slashes. An empty array permits no browser origin. |
| CORS_ALLOW_CREDENTIALS | true; does not itself authenticate a user. |
| LOG_LEVEL | INFO; DEBUG, WARNING, ERROR, CRITICAL also accepted. |
| DB_POOL_SIZE | 5, range 1–50. |
| DB_MAX_OVERFLOW | 10, range 0–50. |
| DB_POOL_TIMEOUT_SECONDS | 30, range 1–120. |
| DB_CONNECT_TIMEOUT_SECONDS | 5, range 1–60. |
| JWT_SECRET_KEY | Required: randomly generated, at least 32 UTF-8 bytes, at least 12 distinct characters, and no obvious placeholder text. |
| JWT_ALGORITHM | HS256 only; other algorithms fail startup. |
| JWT_ISSUER | steepx |
| JWT_AUDIENCE | steepx-api |
| ACCESS_TOKEN_EXPIRE_MINUTES | 30, range 1–60. |
| BILLING_DUE_DAYS | 14, range 0–365; default invoice payment term. |
| BILLING_CURRENCY | USD; default finance-report currency filter, not currency conversion. |

DATABASE_URL is used directly; the backend does not derive it from POSTGRES_*.
Docker Compose uses the root environment file independently. URL-encode reserved
characters in database credentials. localhost and 127.0.0.1 are distinct browser
origins.

JWT configuration fails closed. Changing the signing key invalidates existing
tokens; all local application processes must use the same key. Database migrations
and bootstrap use database settings independently and do not require a JWT secret.

The previously invalid local JWT configuration has been fixed with a generated
backend/.env override. Root .env was preserved and no key was displayed. For a new
checkout only, this helper adds a backend override:

~~~powershell
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.configure_local_jwt
~~~

Run it deliberately: it preserves other backend settings and refuses to replace an
existing backend key or act while a process key override is present. It writes a
local secret to backend/.env, which must remain private and untracked. The current
real-configuration status is recorded in the verification report.

## Start locally

Prerequisites: Python 3.12, the existing virtual environment with pinned requirements,
and Docker Desktop for PostgreSQL. If dependencies are missing, review the exact
installation change first; do not upgrade unrelated versions.

~~~powershell
Set-Location 'C:\Programming\SteepX'
docker compose up -d postgres
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.inspect_local_db
~~~

The inspection is read-only: it prints package versions, invalid setting names
without values, and whether the local PostgreSQL identity matches. It does not
apply migrations. The existing Compose service is PostgreSQL 17, bound to localhost
port 5433 by default and container port 5432. Existing volume credentials do not
change merely because environment files change.

Review the migration, then apply it explicitly to the confirmed local database:

~~~powershell
& .\.venv\Scripts\python.exe -m scripts.migrate_local
& .\.venv\Scripts\python.exe -m scripts.check_migrations --target development
~~~

This command checks the target before applying Alembic upgrades. It rejects remote,
mismatched, or unrecognized targets; do not bypass it to force an uncertain target.
The revisions add auth, catalog, agreement, billing, and demo-receipt tables plus
nullable tax/discount references. The catalog revision backfills missing profiles.
They do not drop tables or overwrite existing user records. Conflicting tables
cause failure; destructive downgrades are disabled. Migrations were exercised on
isolated test/demo targets; see the current verification report for development-target status.

~~~powershell
& .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --no-access-log
~~~

The existing activated-environment `uvicorn main:app --reload --port 8000` command
remains compatible. Stop your server with Ctrl+C; reload is for local development.
OpenAPI: http://localhost:8000/openapi.json; Swagger: /docs; ReDoc: /redoc.
Documentation UI assets may require CDN access.

Application startup does not connect to PostgreSQL, apply migrations, create users,
or seed data. GET /api/v1/health preserves its original liveness response. Authentication
endpoints require the database and applied migration; health does not verify them.

## Sessions and transactions

Synchronous endpoints use synchronous Psycopg 3 sessions. Each request gets one
session; cleanup closes it and rolls back unfinished work. Services use
`with session.begin():` for reads and writes. Dependencies never commit.
Autobegin and autoflush are disabled; explicit flushes obtain IDs/check constraints.
Loaded values remain available after commit; construct output schemas before
leaving the transaction to avoid lazy reads during serialization.

Do not share a session across concurrent requests/tasks. Helpers in an existing
transaction must not start a second outer transaction. TimestampMixin uses
timezone-aware PostgreSQL timestamps and UTC values for SQLAlchemy updates;
external SQL must maintain updated_at itself. No trigger is installed.

Alembic uses the same database settings, metadata, and an unpooled migration engine.
The automated suite supplies a separately verified test connection. Online Alembic
commands access a database; offline SQL generation does not. Autogenerated future
revisions must be reviewed before execution. There is no create_all startup path.

## First administrator and staff

Public registration always creates a customer. No HTTP admin registration or
bootstrap endpoint exists. After applying the local migration:

~~~powershell
& .\.venv\Scripts\python.exe -m scripts.bootstrap_admin
~~~

The command requires an interactive terminal, verifies the local target, asks for
the explicit confirmation phrase, and prompts for email plus a hidden password
twice. No password argument, default credentials, or automatic startup invocation
exists. It rejects any existing administrator (including disabled admins), a duplicate
email, and attempts to promote existing customers. A PostgreSQL advisory transaction
lock serializes concurrent bootstrap attempts.

This is a trusted local administrative operation: protect machine access and
database credentials. It is not a production account-provisioning workflow.
An authenticated admin can create staff through POST /api/v1/staff. Staff permissions
are role-based; staff editing, disabling, and granular permission management are not
implemented endpoints.

## Automated and real HTTP verification

Default checks do not connect to a database:

~~~powershell
& .\.venv\Scripts\python.exe -m pytest -q
~~~

Database integration is explicitly enabled. Prepare a fresh dedicated test database:

~~~powershell
& .\.venv\Scripts\python.exe -m scripts.prepare_test_database
& .\.venv\Scripts\python.exe -m pytest -q --run-db
~~~

Preparation first confirms the local development identity, creates a uniquely named
database, marks its ownership, and writes only its name to
backend/tmp/phase2-test-target.json. No credentials are copied there. Each preparation
creates a new database; it never drops databases or deletes volumes. The suite
refuses unrecognized names or missing ownership markers. Most test writes roll back;
concurrency checks clean up only their own uniquely identified committed records.

The suite applies the migration to this marked database and checks model/migration
agreement. No SQLite replacement or mocked database is counted as PostgreSQL coverage.
Reusing the manifest permits reruns; keep the database reserved for tests.

For a real loopback HTTP check of the preserved entry point:

~~~powershell
& .\.venv\Scripts\python.exe -m scripts.verify_phase2_http
~~~

Run after the integration suite has migrated the test database. It requires an
empty marked database, launches its own Uvicorn process with a generated in-memory
test signing key, exercises authentication/RBAC/logout, stops only that process,
and removes only records it created. It never displays credentials, tokens, hashes,
or response bodies. Test databases and their schemas remain; no destructive reset
command is provided.

## Errors, logging, and common issues

- Invalid JWT configuration: generate a strong key deliberately, review process
  overrides, then restart. The key is never displayed by the helper.
- Database identity guard refusal: review local host, port, database/user match,
  Compose state, and the root configuration privately. Do not disable the guard.
- Missing test manifest/marker: run preparation against the confirmed local server.
  Database integration fails or is explicitly skipped; it is not replaced by mocks.
- Relation missing on auth requests: apply the reviewed migration to the intended
  local database. A working health endpoint does not imply that tables exist.
- 401: invalid credentials/token, expired/revoked session, or disabled account.
  403: authenticated account lacks the required role.
- 409 on registration: account creation conflicts with existing details; database
  constraints handle concurrent attempts.
- Bootstrap refusal: an admin already exists, the email is in use, input is invalid,
  the terminal is noninteractive, or the target is not confirmed local.
- CORS mismatch: configure the exact frontend origin; CORS is not an authorization
  boundary and PowerShell does not enforce browser CORS.

Responses use the existing error envelope. Validation output omits submitted input,
context, and raw validator messages. Password errors use a deliberate safe message.
Unexpected exceptions and preformatted tracebacks are suppressed; raw access logs
and SQL parameters are disabled. Future code must not log secrets in ordinary
messages; the formatter is not a general-purpose secret scanner. Reverse-proxy
logs also need a suitable policy.

## Reproducible isolated demonstration

These commands explicitly select a separately marked local demo database. They
never seed the normal development database, reset data, or run on application startup.
The preparation step verifies the local server, creates a demo database if no
manifest exists, and applies migrations. Reruns reuse the marked target.

```powershell
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.prepare_demo_database --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.bootstrap_demo_admin --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.run_demo --target isolated-demo --port 8000
```

Stop with Ctrl+C. The separate bootstrap creates the demo admin; the seed cannot
create or promote an admin. Generated credentials live only in
`backend/tmp/demo-credentials.json`, tied to `backend/tmp/demo-target.json`.
Both files are ignored. Restrict local filesystem access, never publish the credential
file, and never reuse these accounts in production. No credentials are printed.
The interactive `scripts.bootstrap_admin` remains the normal development procedure.

The seed creates 1 staff and 3 customers, 1 product, 2 variants/add-ons, 4 billing
intervals, 1 tax example, 2 discounts, 1 template, 10 quotations, 7 subscriptions,
6 invoices, and 2 payments; the separate bootstrap provides the fifth account.
Examples include active/paused/closed/confirmed subscriptions and paid, unpaid,
and overdue invoices. Dates are relative to the **first** seed, then preserved.

A database receipt and advisory lock make seeding atomic and repeat-safe. Reruns
preserve records, including deliberate reviewer edits; they do not restore altered
or manually removed records. Name collisions abort and roll back instead of adopting
unrelated records. Lost credentials require a separately reviewed recovery; neither
bootstrap nor seeding resets existing passwords. There is no destructive cleanup
command. Keep the isolated database for review, or request a scoped cleanup plan.

Verify the demo through a real temporary local server:

```powershell
& .\.venv\Scripts\python.exe -m scripts.verify_business_http --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.export_openapi
```

The HTTP helper checks demo relationships/balances and creates its own temporary
business workflow, removes only its identified records and login sessions, and
stops its server. The OpenAPI export does not start an application or access a database.

## Frontend handoff and limitations

Use `/api/v1`, JSON request bodies, and `Authorization: Bearer <token>`.
OpenAPI is at `/openapi.json`, with a checked-in snapshot in [docs/openapi.json](docs/openapi.json).
Role restrictions are included as `x-roles` for restricted operations. See the
[complete endpoint catalog](docs/api.md) and [PowerShell workflows](docs/manual-verification.md).
Set `CORS_ORIGINS` to the teammate's exact localhost origin; no frontend files were changed.

There are no real payments, gateway calls, emails, refresh tokens, password-reset
delivery, email verification, rate limiting, granular staff permissions, account
disable/edit API, credit notes/refunds, proration, or automatic billing scheduler.
Invoices are generated explicitly one due period at a time. Pause defers generation
without forgiving charges. Review these commercial defaults in the business rules.
Production deployment needs HTTPS, managed secrets, abuse controls, backups, and
operational review. Old auth sessions are retained; retention remains future work.

Application logs use JSON with UTC timestamp, level, logger and safe message.
Exception details, SQL parameters and access logs are suppressed. This is not a
general secret scrubber: do not add request bodies or credentials to log messages.
No thousands-of-record load benchmark or production certification is claimed.

The two root .gitignore exclusions for backend README/docs were removed so source
documentation can be tracked. Environment files, temporary manifests and demo
credentials remain ignored. No Git commands were used.
