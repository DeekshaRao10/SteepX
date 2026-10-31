# Phases 3–8 implementation and verification report

## Final observed result

**201 automated tests passed, 0 failed, 0 skipped in 32.97 seconds.** This includes
the existing Phase 1/2 regression coverage and new PostgreSQL business/concurrency
tests. **50 live business HTTP checks passed**, plus **14 live authentication HTTP
checks passed**. Both helpers launched the compatible `main:app` entry point and
stopped their own processes. No frontend/browser or production verification is claimed.

Alembic reached **20261101_05** on the confirmed local development database and on
separate marked test/demo databases. Development and demo revision/model checks
reported **No new upgrade operations detected**; the full test suite also checks
migration/model agreement. No SQLite substitute was used for database integration.

Demo seed executed successfully, then ran again without duplication. Its relationships
and invoice/payment balances were checked through PostgreSQL and the live API helper.
The final HTTP rerun again passed 50 checks after the full automated suite.

## Implemented phases and contract

| Phase | Delivered |
| --- | --- |
| 3 | Customer profiles/administration, products, variants/add-ons, four plan intervals, archive/validation, bounded filtered lists |
| 4 | Quotation templates and snapshots, quotation states/expiry, subscriptions, activation, pause/resume/close/renew, ownership |
| 5 | Decimal calculations, configured taxes/discounts, anchored billing periods, invoice snapshots/numbering/status/balances, safe retries |
| 6 | Manual immutable payments, idempotency/reference protection, transaction-safe balances, dashboard and revenue reports |
| 7 | Separate demo admin bootstrap, isolated marked target, atomic repeat-safe seed, generated local-only credentials, demo server/helper |
| 8 | Explicit schemas, 61 versioned operations, 34 role-restricted operations with OpenAPI x-roles, error conventions, CORS, logging and handoff |

The [API guide](api.md) contains every endpoint, request/response model, status and
authorization requirement. The [OpenAPI snapshot](openapi.json) is generated from
the implementation; /openapi.json, /docs and /redoc remain available at runtime.
Customers are limited to their own profiles/agreements/invoices/payments. Catalog
mutations, internal cost access and financial writes require staff/admin; tax/discount writes require
admin. Login/register/health remain public. No public admin/bootstrap endpoint exists.

## Environment, configuration and safety

- Windows PowerShell, C:\Programming\SteepX\backend, existing Python 3.12.2 environment.
- Existing pins reused: FastAPI 0.162.0, SQLAlchemy 2.1.6, Alembic 1.20.1, Psycopg
  3.3.6, Pydantic 2.14.2, Pydantic Settings 2.16.2, PyJWT 2.15.1, pwdlib 0.3.1,
  Argon2-cffi 25.1.0, pytest 9.2.0, HTTPX 0.28.1. No dependency installation/upgrade.
- The prior JWT configuration failure was fixed by explicitly running
  scripts.configure_local_jwt. It wrote only a generated backend/.env override.
  Repeated settings inspection reported JWT configuration valid. Root .env was
  preserved; secret values were never printed or copied into documentation.
- Precedence remains process environment > optional backend/.env > root .env > defaults.
- Local target checks matched loopback host, configured development database/user,
  local port, PostgreSQL 17 server identity and non-recovery state before mutation.
  Isolated targets additionally require recognized names and ownership comments.
- The existing marked test database was reused. A separate marked demo database was
  created, recorded in backend/tmp/demo-target.json. Manifests contain no credentials.
- Reviewed additive migrations were applied to the confirmed development target.
  No real development admin or demo accounts were created there. The admin/demo
  accounts created during this task belong only to isolated targets.
- No Git commands, frontend edits, production access, real payments, gateway calls,
  emails, database drops/truncation/resets, Docker volume deletion or destructive
  migrations occurred. Test cleanup targeted only this task's identified records.
- Root .gitignore changed only to remove backend README/docs exclusions. Environment
  files, tmp manifests, generated demo credentials, virtual environments and caches
  remain ignored. The historical Phase 2 report keeps its original observations.

## Commands actually executed

All commands below ran from C:\Programming\SteepX\backend. None contains secret values.
Inspection/file-reading operations are omitted from this execution list.

```powershell
& .\.venv\Scripts\python.exe -m scripts.configure_local_jwt
& .\.venv\Scripts\python.exe -m scripts.inspect_local_db
& .\.venv\Scripts\python.exe -m pytest -q --run-db
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_catalog.py
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_commerce.py
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_billing_math.py tests/test_billing.py tests/test_commerce.py
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_financial_concurrency.py tests/test_billing.py tests/test_commerce.py tests/test_regression.py
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_business_edges.py tests/test_demo.py
& .\.venv\Scripts\python.exe -m pytest -q tests/test_api_contract.py tests/test_regression.py tests/test_security.py
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_billing_math.py tests/test_business_edges.py
& .\.venv\Scripts\python.exe -m scripts.make_migration --revision 20261101_05 --message demo_receipt
& .\.venv\Scripts\python.exe -m scripts.prepare_demo_database --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.bootstrap_demo_admin --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.verify_business_http --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.verify_phase2_http
& .\.venv\Scripts\python.exe -m scripts.export_openapi
& .\.venv\Scripts\python.exe -m scripts.inspect_local_db
& .\.venv\Scripts\python.exe -m scripts.migrate_local
& .\.venv\Scripts\python.exe -m scripts.check_migrations --target development
& .\.venv\Scripts\python.exe -m pytest -q --run-db
& .\.venv\Scripts\python.exe -m scripts.verify_business_http --target isolated-demo
```

Some focused commands were repeated after fixes. Revisions 02–04 were also generated
against the confirmed test target, inspected as files and then applied by test fixtures.
Generation itself did not apply upgrades. No interactive password-entry command was
driven; demo bootstrap uses generated credentials and the normal bootstrap was covered
by existing service/concurrency/noninteractive-refusal tests.

## Observed runs, failures and fixes

| Run | Actual outcome / action |
| --- | --- |
| Fresh baseline full suite | 119 passed in 13.71s; previous reported results were not assumed |
| Catalog plus auth integration | 1 failed, 64 passed; query-model binding conflicted with a separate interval filter |
| Catalog after dependency fix | 16 passed in 7.81s |
| Initial agreements | 10 passed in 8.48s |
| Billing math/billing/agreements | 38 passed in 12.83s |
| First date-validation/concurrency invocation | Collection failed: accidental CalendarDatetime rename; corrected paused_at annotation before executing tests |
| Concurrency/billing/agreements/regression | 47 passed in 20.34s |
| First boundary/demo run | 1 failed, 15 passed in 10.52s; empty aggregates serialized 0 instead of 0.00 |
| Boundary/demo after money formatting fix | 16 passed in 10.17s |
| Expanded full suite | 1 failed, 194 passed in 31.84s; x-roles metadata was missing on lazily included FastAPI routers |
| Contract/security/regression after recursive annotation fix | 65 passed in 3.53s |
| Further calendar, discount and term-edge coverage | 40 passed in 9.85s |
| Final full suite | **201 passed in 32.97s; no failures/skips** |
| Authentication live HTTP | **14 checks passed**; isolated users/auth_sessions both zero afterward |
| Business live HTTP, including final rerun | **50 checks passed each run**; generated credentials/tokens absent from server log scan |

Tests did not bypass authentication, weaken constraints or replace PostgreSQL with
mocks to fix failures. The final suite includes every existing test and the new
business tests. Only explicitly DB-marked tests would skip without --run-db; that
was not the final invocation. No required integration test remained blocked.

## Coverage exercised

| Area | Observed coverage |
| --- | --- |
| Auth/RBAC regression | Registration/password policy/normalization/duplicates/role injection, login, malformed/expired/invalid JWTs, disabled users, logout revocation, bootstrap restrictions/concurrency, staff creation |
| Catalog/profiles | CRUD/archive, validation and unique names, costs hidden from customer access, own profile changes, forbidden fields, pagination/filtering, inactive/unavailable/minimum-quantity plans |
| Agreements | Pricing snapshots, templates, expired quotation rejection, valid/invalid/idempotent state actions, repeat conversion and renewal, customer isolation, inactive customer activation refusal |
| Billing dates | Daily/weekly/monthly/yearly database workflows, leap day, true month-end, temporary clamping without drift, UTC calendar-only input, no skipped periods, clipped terms, natural expiry, zero-total invoice |
| Money/tax/discount | Decimal HALF_UP rounding, largest-remainder allocation, fixed/percentage discounts and caps, inclusive dates, eligibility failures, tax snapshots, discount usage limits |
| Concurrent PostgreSQL transactions | Same period produces one invoice; same payment key produces one payment; separate simultaneous payments cannot overpay; global discount limit holds across subscriptions |
| Payments/finance | Draft refusal, partial/full settlement, overpayment/duplicate-key/reference rejection, rollback leaves balance unchanged, ownership, cash vs issued totals, overdue/current balances, currency/date filters |
| Demo | Failure injected during seed rolls back all non-admin seed work; repeat seed retains IDs/counts; stored invoice totals satisfy invoice accounting and match payment balances; actual demo CLI executed twice |
| API/regression | Health exact response, compatible startup, OpenAPI endpoint/snapshot schemas/error envelopes/security metadata, CORS, safe failures/logging and no public bootstrap |

The live business helper logged in as demo admin/staff/customer, created a separate
temporary customer/product/variant/tax/discount/plan, exercised quotation→subscription
→invoice→partial/full payment→renewal, checked role denials and foreign ownership,
verified dashboard cash, and tested logout. Its initial read checked stored demo
IDs and payment balances. It removed only its captured UUIDs/sessions in foreign-key
order. Seeded demo records remain available. The log scan is limited to generated
credential/token values known to that run; it is not a universal data-loss guarantee.

## Schema and transaction review

New revisions:

- 20261101_02: customers, products, product_variants, plans; profile backfill uses
  existing customer user IDs with ON CONFLICT DO NOTHING.
- 20261101_03: quotation_templates, quotations/quotation_lines,
  subscriptions/subscription_lines; unique quotation conversion and renewal parent.
- 20261101_04: tax_rates, discount_rules, invoices/invoice_lines, discount_usage,
  payments; nullable tax/discount associations on prior tables.
- 20261101_05: demo_runs receipt; no seeded data in migrations.

All upgrades are additive. Foreign keys, unique names/codes, valid states/intervals,
nonnegative monetary values, date ordering, invoice totals/balances and payment
constraints protect integrity. Invoice subscription/start/index combinations,
payment idempotency keys and invoice references, and discount usage invoice IDs
are unique. Monetary precision is NUMERIC(20,2); rates use four decimals. Timestamps
are timezone-aware. Customer/date/state/billing indexes support filters/aggregates.

Services retain explicit transactions with synchronous Psycopg and request-scoped
cleanup. Invoice generation locks the subscription then the discount; payment
recording locks the invoice. Failed inserts roll back the period pointer, usage
and balances. List handlers batch-load line data; reports aggregate in PostgreSQL.
Application startup creates no tables, users, migrations or demo data. Downgrades
refuse destructive execution. The development target was checked again before its
upgrade and subsequently passed the read-only Alembic revision/model check.

## Created and changed files

Paths below are relative to backend/ except the root .gitignore.

| Files | Purpose |
| --- | --- |
| app/models/catalog.py, commerce.py, billing.py, demo.py (new) | Relational business entities and explicit seed receipt |
| app/schemas/common.py, catalog.py, commerce.py, billing.py, finance.py (new) | Validated inputs, safe typed snapshots, pagination, decimal/date contracts |
| app/services/common.py, catalog.py, commerce.py, pricing.py, discounts.py, billing.py, payments.py, finance.py, demo.py (new) | Ownership, transactions, lifecycle, accounting, aggregates and atomic demo generation |
| app/core/billing_dates.py, lifecycle.py (new) | Central anchored calendar and transition rules |
| app/api/v1/endpoints/catalog.py, commerce.py, billing.py (new) | Thin versioned resource routes |
| app/api/v1/api.py, app/models/__init__.py | Router/model registration |
| app/services/auth.py | Customer registration now creates its profile atomically |
| app/core/config.py, errors.py, logging.py, permissions.py, app/application.py | Billing settings, safe date errors, JSON logs, role metadata and common OpenAPI errors |
| migrations/versions/20261101_02_catalog.py, 03_agreements.py, 04_billing.py, 05_demo_receipt.py (new, all names retain 20261101_ prefix) | Reviewed additive schema revisions |
| migrations/script.py.mako | Generated downgrades refuse destructive operation |
| scripts/make_migration.py, check_migrations.py (new) | Confirmed-target generation and read-only migration/model inspection |
| scripts/prepare_demo_database.py, demo_credentials.py, bootstrap_demo_admin.py, seed_demo.py, run_demo.py (new) | Explicit isolated demonstration, separate bootstrap, local-only credentials |
| scripts/verify_business_http.py, export_openapi.py (new) | Live business checks and reproducible API export |
| scripts/local_database.py, verify_phase2_http.py | Demo target guards and exact test customer-profile cleanup |
| tests/test_catalog.py, test_commerce.py, test_billing_math.py, test_billing.py, test_financial_concurrency.py, test_business_edges.py, test_demo.py, test_api_contract.py (new) | Business, concurrent, seed, security/contract verification |
| tests/conftest.py, test_auth_integration.py | Profile fixtures/cleanup and current migration-head checks |
| README.md, docs/api.md, docs/manual-verification.md | Full setup, endpoint contract, business/manual/demo workflows |
| docs/business-rules.md, docs/openapi.json, docs/phase-3-to-8-verification.md (new) | Commercial defaults, generated contract, this report |
| docs/phase-2-verification.md | Historical results retained; forward link added |
| .env.example | Billing defaults; no real secrets |
| .env (generated local-only) | Strong generated JWT override; root configuration preserved |
| tmp/demo-target.json, tmp/demo-credentials.json (generated ignored files) | Isolated target name and private local demo accounts |
| ../.gitignore | Removed only backend README/docs exclusions |

requirements.txt, the frontend, and backend/main.py compatibility entry point were
not changed. No dependencies were installed or upgraded.

## Commercial assumptions and remaining limitations

See [business-rules.md](business-rules.md) for the exact contract. Defaults include
discount-before-tax, per-line HALF_UP tax, one discount per agreement, one tax per
plan, two decimal currency units, 14-day due terms, full period charge when clipped,
pause retaining backlog, explicit operator billing, and renewal as a new subscription.
These are configurable data/service rules, not jurisdictional compliance claims.

No real payment/email integration, automatic billing scheduler, proration, refunds,
credit notes, invoice cancellation, refresh tokens, password-reset delivery, email
verification, abuse/rate limiting, granular staff editing, account-disable API or
session-retention job was implemented. Production needs HTTPS, secrets management,
backups, deployment hardening, accounting review and operational ownership.
Expired subscriptions are effectively closed in queries; a quote retains its last
explicit state event until closure/renewal. Existing draft invoices consume discount
usage and cannot be cancelled through the current API. Different payment keys are
different intentions unless a reference collision identifies a duplicate.

No thousands-of-record load benchmark, frontend/browser interaction, production
test, external email/payment test, or interactive normal-bootstrap terminal flow
was performed. These are unverified or deliberately excluded scope, not passed checks.
There is no destructive demo reset/cleanup command. Demo credentials and target
manifests are retained locally; repeat seeding preserves reviewer edits, not repairs them.

## Remaining manual setup / reviewer workflow

Local JWT setup and development migrations are already completed in this workspace.
Create the first normal development admin explicitly with scripts.bootstrap_admin
if needed; this was intentionally not done automatically. For demonstration, the
isolated demo target and generated accounts already exist:

```powershell
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.run_demo --target isolated-demo --port 8000
```

Use the private local credentials as shown in the manual guide, then /docs or
/openapi.json for the frontend contract. For the normal development target use
`python -m uvicorn main:app --reload --port 8000 --no-access-log`. Stop with Ctrl+C.
Configure the teammate's exact CORS origin if it differs from localhost:3000.
No verification process was left running. No phase beyond Phase 8 was started.
