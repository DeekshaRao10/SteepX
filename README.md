# SteepX ? Brightloop Subscription Management & Billing

SteepX uses the existing Next.js frontend and FastAPI `/api/v1` API with PostgreSQL. Application screens read and write real backend records; there is no mock fallback. Backend roles and customer ownership checks apply to every request.

## Start locally (PowerShell)

Use the existing environment files and accounts. Do not replace existing `.env` files.

Start PostgreSQL from the repository root:

```powershell
cd C:\Programming\SteepX
docker compose up -d postgres
```

In a backend terminal:

```powershell
cd C:\Programming\SteepX\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In a frontend terminal:

```powershell
cd C:\Programming\SteepX\frontend
npm run dev
```

Open http://localhost:3000. API documentation: http://localhost:8000/docs. Use port 3000, or add the actual frontend origin to the backend's `CORS_ORIGINS` and restart the backend.

For a production frontend build, run `npm run build` followed by `npm start` in `frontend`.

## First-time setup only

- If dependencies are absent: create `backend/.venv` with `python -m venv .venv`, install `backend/requirements.txt` with that environment's Python, and run `npm ci` in `frontend`. Existing dependency versions are retained.
- The project `.env` supplies PostgreSQL settings. `backend/.env` can override backend settings; process environment has the highest priority. Use the example files as templates only when local files do not exist. `JWT_SECRET_KEY` must be a securely generated random secret, never a public frontend variable. The existing `python -m scripts.configure_local_jwt` helper configures a local secret without displaying it.
- Next.js reads `frontend/.env.local`, not the root `.env`. Copy `frontend/.env.example` there only when needed and only if the local file does not already exist. `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000/api/v1`; it must include `/api/v1`. Public variables are embedded at build time, so rebuild after changing them.
- Apply existing migrations to a new local development database with `.\.venv\Scripts\python.exe -m scripts.migrate_local` from `backend`. This applies additive migrations; it does not reset the database.
- If the development database has no administrator, run `.\.venv\Scripts\python.exe -m scripts.bootstrap_admin` interactively from `backend`. Password entry is hidden and the command refuses to replace an existing administrator. Do not seed or reset an existing database.

## Accounts and workflows

- Sign in using the actual account email and password. Roles come from the backend; the UI cannot switch or grant roles. Bearer sessions are scoped to the browser tab, validated with `/auth/me`, and revoked with `/auth/logout`. Expired sessions return to sign-in. There is no refresh-token endpoint.
- Public registration creates a **customer** and billing profile. Customers can update their profile and access only their own quotations, subscriptions, invoices, and payment history.
- Administrators create **staff** under Settings & Team. Administrators and staff can create customer accounts under Customers. Share initial passwords securely; these actions do not send invitation emails. Passwords require 9?128 characters with uppercase, lowercase, and a special character.
- Operators manage products and their variants/add-ons, plans, customers, agreements, and billing. Product detail includes variant/add-on editing and archiving. Plans select an optional tax rate. Administrators manage tax rates and discounts; staff can view those rules and assign existing taxes to plans.
- Create a quotation from actual plans and variants, optionally using a template or discount code. All lines must share currency, billing interval, and end behavior. Save the draft to calculate prices, taxes, and discounts on the server. Review, issue, accept, and convert it to a confirmed subscription. Activate when its start date arrives. Pause, resume, close, or renew using the lifecycle actions. Renewals use current catalog prices.
- Generate an invoice from the earliest unbilled subscription period, review the draft, then confirm it. No arbitrary client-supplied invoice totals are accepted. Operators can record cash, bank transfer, check, or other manual payments against confirmed invoices. Payment retries reuse an idempotency key. Customers can view payments but cannot record them.
- Finance reports use real invoices and receipts, filter by date and currency, and exclude draft invoices from receivables. Currency totals are kept separate. The Customers summary labels its paid total in USD; individual financial documents show their actual currency.
- Archive operations retain historical records. No background invoice scheduler or online payment gateway is provided by the current backend; billing and settlements use the explicit actions above.

Email password recovery and editable organization settings do not have backend endpoints. The UI does not claim to send recovery emails or save organization changes.

## Populate the existing local development database

This is an explicit, additive operation. It verifies the configured local PostgreSQL target and reuses the existing active administrator. It does not reset data, change passwords, promote accounts, modify environment files, or contact a payment gateway.

```powershell
cd C:\Programming\SteepX\backend
.\.venv\Scripts\python.exe -m scripts.seed_demo --target development
```

The development dataset contains 2 staff, 6 customers, 9 products, 18 variants and 18 add-ons, 27 weekly/monthly/yearly plans, 4 tax rates, 5 discounts, 5 quotation templates, 26 quotations, 18 subscriptions, 36 invoices, and 31 manual payment records. Amounts use USD and the existing billing calculations. A transaction and a persistent `steepx-development-demo-v1` receipt make repeated runs retain the original records instead of creating duplicates or reverting your edits. Dates are anchored to the first successful run; rerunning does not move due dates or refresh expired offers.

The first-admin bootstrap refuses additional administrators. When an administrator already exists, use that account; `admin.demo@example.com` is not created or promoted. If no active administrator exists, follow the separate bootstrap instructions above before seeding.

New demo passwords are generated independently and hashed with the application's authentication service. Their retrieval copy is encrypted using Windows DPAPI in `backend/tmp/development-demo-credentials.json`; the existing `tmp/` ignore rule excludes this file. Only the Windows account that created it can decrypt it. Do not publish or move the credential file. Passwords for reused accounts are neither retrieved nor changed.

List account aliases and email addresses without showing passwords:

```powershell
.\.venv\Scripts\python.exe -m scripts.development_demo_credentials --list
```

Open http://localhost:3000/login. Use `staff.demo@example.com` or `customer.demo@example.com` and copy its generated password directly to your local clipboard:

```powershell
.\.venv\Scripts\python.exe -m scripts.development_demo_credentials --account staff --copy-password
# Or, for the customer account:
.\.venv\Scripts\python.exe -m scripts.development_demo_credentials --account customer --copy-password
```

Paste into the password field. Afterwards, clear the clipboard with `Set-Clipboard -Value ''` and clear any saved clipboard-history entry. Additional aliases include `staff_billing`, `customer_northstar`, `customer_harbor`, `customer_orbit`, `customer_lumen`, and `customer_summit`. For the `admin` alias, use the existing admin password; the seeder does not store a copy.

With the regular backend running on port 8000, verify invoice arithmetic, relationships, actual staff/customer login and logout, customer isolation, API lists, and finance reports:

```powershell
.\.venv\Scripts\python.exe -m scripts.verify_development_demo --target development
```

The verification command does not modify business records. It creates and revokes its own test login sessions, writes a password-free summary to `backend/tmp/development-demo-report.json`, and only contacts a loopback HTTP API. The original `--target isolated-demo` workflow remains available for its separate, marked database; use `--target development` to populate the database used by the normal local application.

## Focused verification

```powershell
cd C:\Programming\SteepX\backend
.\.venv\Scripts\python.exe -m pytest -q tests/test_security.py tests/test_api_contract.py
.\.venv\Scripts\python.exe -m pytest --run-db -q tests/test_frontend_integration.py tests/test_catalog.py
```

Database tests use the existing marked isolated target in `backend/tmp/phase2-test-target.json`, verify its identity, and roll back test records. They never target the development database. If no test target exists, explicitly prepare a fresh isolated target with `python -m scripts.prepare_test_database`; no existing database is dropped.

```powershell
cd C:\Programming\SteepX\frontend
npx tsc --noEmit
npx eslint src
npm run build
```

After a backend schema change, run `python -m scripts.export_openapi` in `backend`, then `node scripts/generate-api-types.mjs` in `frontend` to refresh the typed API contract.
