# Manual verification — Phases 1–8

These commands are for a developer to run locally. They are not themselves evidence
that a manual scenario passed. Automated/API checks actually executed are listed
in [phase-3-to-8-verification.md](phase-3-to-8-verification.md), with counts and limitations.
The historical Phase 2 report is retained separately.
The user separately confirmed Phase 1 startup and health.

## Prerequisites and startup

Use the setup instructions in [README](../README.md): a valid local JWT key, the
reviewed migration applied to the confirmed development database, and PostgreSQL.
Do not print .env files or modify/reset existing records to make a check pass.

~~~powershell
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.inspect_local_db
& .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --no-access-log
~~~

Stop this foreground server with Ctrl+C. Use another terminal for requests:

~~~powershell
$baseUrl = 'http://localhost:8000'
~~~

For automated checks, the following are implemented commands:

~~~powershell
& .\.venv\Scripts\python.exe -m pytest -q
# Once, when you deliberately want a new isolated local test database:
& .\.venv\Scripts\python.exe -m scripts.prepare_test_database
& .\.venv\Scripts\python.exe -m pytest -q --run-db
# After integration has applied migrations to that marked test database:
& .\.venv\Scripts\python.exe -m scripts.verify_phase2_http
~~~

Preparation creates a separate marked database and stores only its name in an
ignored local manifest. It does not destroy anything. Do not repeatedly prepare
databases unnecessarily; rerun tests using the existing manifest. Tests roll back
their writes or delete only their own uniquely marked records. No database/volume
deletion command is provided.

## Public health and OpenAPI

GET /api/v1/health, no headers/body/authentication:

~~~powershell
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/health"
$schema = Invoke-RestMethod -Method Get -Uri "$baseUrl/openapi.json"
$schema.paths.'/api/v1/auth/me'
~~~

Expected 200 health: status=ok and service=Brightloop Subscription API, unchanged.
No database query/write occurs; health does not validate migrations or connectivity.
Repeated calls have no business effect. Role-denial and customer isolation are
not applicable to this public endpoint.

Expected OpenAPI 200: health, authentication, catalog, agreements, billing and finance;
protected operations document bearer security. There is no HTTP admin-bootstrap
operation. /docs and /redoc should be available when their UI assets can load.

## Customer registration

POST /api/v1/auth/register, Content-Type: application/json, no token.
Use a new local-only email so you do not overwrite or collide with existing data.
The JSON contract is:

~~~json
{"email":"customer@example.com","password":"ExampleOnly!902"}
~~~

This is fake sample data. Prefer a hidden prompt for the password you actually use:

~~~powershell
$email = 'manual-customer@example.com'
$securePassword = Read-Host 'Local test password' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
$credentials = @{ email = $email; password = $plainPassword } | ConvertTo-Json
$registered = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/register" `
    -ContentType 'application/json' -Body $credentials
$registered | Select-Object id, email, role, is_active
~~~

Expected 201 UserResponse: UUID, normalized email, role=customer, active=true, and
timezone-aware timestamps. No hash/password/token is returned. Database result:
one customer with an Argon2id hash.

Negative cases: missing/invalid email, password length <=8 or >128, missing uppercase,
lowercase, or special character, role=admin/staff/customer, and malformed JSON
should return 422 in the standard envelope. Password whitespace alone is not a
special character. Repeating the same normalized email, including case variations,
should return 409 without creating another row. Public registration requires no token.

There is no endpoint to select another customer's ownership or elevate a role.
Do not alter existing users to exercise this case.

## Login and safe token handling

POST /api/v1/auth/login uses the same JSON email/password body. No bearer token needed.

~~~powershell
$login = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" `
    -ContentType 'application/json' -Body $credentials
$accessToken = $login.access_token
$authHeaders = @{ Authorization = "Bearer $accessToken" }
# Print only non-sensitive metadata, never $login or $accessToken:
$login | Select-Object token_type, expires_in
~~~

Expected 200: bearer token metadata and expires_in (default 1800 seconds). Database
result: one new revocable login session; the token itself is not stored.

Wrong password, unknown email, and disabled account: identical 401 code/message.
Malformed/missing credentials: 422. Disabled-account checks are covered by isolated
automated fixtures; there is no public disable-user endpoint to exercise manually.

For a token obtained elsewhere, prefer Read-Host -AsSecureString and convert it only
into a local variable using NetworkCredential as above. Do not paste a token into
source files, URLs, screenshots, reports, or command-line arguments.

## Current user and invalid token

GET /api/v1/auth/me, bearer header, no body:

~~~powershell
Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/auth/me" -Headers $authHeaders
~~~

Expected 200 safe profile for the token owner. Database result: read only.
A query parameter containing another user's ID must not change the identity returned.
Business-resource ownership scenarios are deferred until actual business models exist.

Expected 401 without a bearer header or with malformed, expired, invalid-signature,
revoked, or disabled-account authentication:

~~~powershell
try {
    Invoke-RestMethod -Method Get -Uri "$baseUrl/api/v1/auth/me" `
        -Headers @{ Authorization = 'Bearer <INVALID_TOKEN>' } -ErrorAction Stop
} catch {
    if ($null -ne $_.Exception.Response) {
        Write-Output ([int]$_.Exception.Response.StatusCode)
    }
    Write-Output $_.ErrorDetails.Message
}
~~~

Expected envelope code unauthenticated, safe generic message, empty details, and
WWW-Authenticate: Bearer. PowerShell error-body display varies by version. Do not
echo failed login request bodies or real tokens when diagnosing errors.

## Role checks and first admin

Bootstrap is a separate interactive operation against the confirmed local database:

~~~powershell
& .\.venv\Scripts\python.exe -m scripts.bootstrap_admin
~~~

No default credentials exist. It requires confirmation, email, and hidden password
confirmation. Existing admin: refuse. Existing customer with that email: refuse,
without promotion. No HTTP endpoint can trigger bootstrap.

POST /api/v1/staff requires an admin bearer token and a JSON email/password body.
Log in as your bootstrapped admin using hidden prompts and capture its token in
$adminToken without printing it:

~~~powershell
$adminEmail = Read-Host 'Admin email'
$adminSecurePassword = Read-Host 'Admin password' -AsSecureString
$adminBody = @{
    email = $adminEmail
    password = [System.Net.NetworkCredential]::new('', $adminSecurePassword).Password
} | ConvertTo-Json
$adminLogin = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" `
    -ContentType 'application/json' -Body $adminBody
$adminToken = $adminLogin.access_token
$adminHeaders = @{ Authorization = "Bearer $adminToken" }
$staffSecurePassword = Read-Host 'New staff password' -AsSecureString
$staffBody = @{
    email = 'manual-staff@example.com'
    password = [System.Net.NetworkCredential]::new('', $staffSecurePassword).Password
} | ConvertTo-Json
$staff = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/staff" `
    -Headers $adminHeaders -ContentType 'application/json' -Body $staffBody
$staff | Select-Object id, email, role
~~~

Expected 201 staff profile. The body accepts only email/password and fixes role=staff.
Missing token: 401. Customer or staff token: 403. Role=admin in the body: 422.
Duplicate email: 409. Only a successful authorized request creates a staff record.

Operator/customer policy combinations are exercised through test-only routes and
dependencies; no production placeholder endpoints were added. Customers cannot
create privileged accounts, and role changes in PostgreSQL affect subsequent
authenticated requests. No granular staff-editing API exists.

## Logout

POST /api/v1/auth/logout, bearer header, no body:

~~~powershell
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/logout" -Headers $authHeaders
~~~

Expected 204, empty body. Repeating /auth/me or logout with that token: 401.
Other sessions remain valid. The database marks only the current session revoked.
Clear local credential/token variables when finished:

~~~powershell
Clear-Variable accessToken, login, authHeaders, credentials, plainPassword, securePassword -ErrorAction SilentlyContinue
Clear-Variable adminToken, adminLogin, adminHeaders, adminBody, adminSecurePassword, staffBody, staffSecurePassword -ErrorAction SilentlyContinue
~~~

Clearing variables reduces accidental display; it does not promise secure erasure
of managed-memory copies.

## CORS, error responses, and logging

An OPTIONS preflight with Origin=http://localhost:3000 and
Access-Control-Request-Method=GET should return 200 with the matching CORS origin.
An unapproved origin should receive a 400 cors_not_allowed envelope. Ordinary
requests can still reach the backend; PowerShell does not enforce browser CORS.

~~~powershell
Invoke-WebRequest -UseBasicParsing -Method Options -Uri "$baseUrl/api/v1/health" `
    -Headers @{ Origin = 'http://localhost:3000'; 'Access-Control-Request-Method' = 'GET' }
~~~

POST to health should return 405; an unknown route should return 404. Both use the
error envelope and make no database change. Generic 500 responses must omit
tracebacks/internal exceptions. Tests inject failures only on test-confined routes;
do not add a debug endpoint to the running application.

Inspect logs for generic lifecycle/error messages. No request bodies, passwords,
JWTs, hashes, database URLs, or exception tracebacks should be displayed. Proxy
logging is outside this local implementation. Report safe status/error codes and
redacted context when asking for help.

## Recorded checklist and demo status

The authoritative current checklist, counts, failures/skips, and migration
results are in [phase-3-to-8-verification.md](phase-3-to-8-verification.md). Mark a new manual
scenario passed only after actually observing its result.

Demo support is implemented and explicitly invoked as below. It never runs at
startup and does not reset/delete existing records. The automated suite exercises
PostgreSQL workflows and concurrent transactions; the separate live HTTP helper
checks the preserved entry point. Copying these PowerShell examples has not been
recorded as an independently executed manual test.

## Prepare a repeatable demonstration

Use the isolated target to avoid mixing demonstrations with existing development data:

```powershell
Set-Location 'C:\Programming\SteepX\backend'
& .\.venv\Scripts\python.exe -m scripts.prepare_demo_database --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.bootstrap_demo_admin --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.seed_demo --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.verify_business_http --target isolated-demo
& .\.venv\Scripts\python.exe -m scripts.run_demo --target isolated-demo --port 8000
```

First seed creates the documented fake dataset; second seed reports existing data
retained. It should not add a second set of records. The separate bootstrap must
precede seeding. The HTTP helper starts/stops its own temporary server and cleans
only its created records; the final run_demo command stays in the foreground.
Stop with Ctrl+C. Do not start another server on the same port.

In another terminal, load generated credentials into memory without displaying them:

```powershell
Set-Location 'C:\Programming\SteepX\backend'
$baseUrl = 'http://localhost:8000'
$demoAccounts = (Get-Content -LiteralPath '.\tmp\demo-credentials.json' -Raw | ConvertFrom-Json).accounts
function Get-DemoHeaders($account) {
    $body = @{ email = $account.email; password = $account.password } | ConvertTo-Json
    $result = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/login" -ContentType 'application/json' -Body $body
    return @{ Authorization = "Bearer $($result.access_token)" }
}
$adminHeaders = Get-DemoHeaders $demoAccounts.admin
$staffHeaders = Get-DemoHeaders $demoAccounts.staff
$customerHeaders = Get-DemoHeaders $demoAccounts.customer1
$otherHeaders = Get-DemoHeaders $demoAccounts.customer2
```

Expected login 200; token stays inside a local header variable. Do not echo these
variables, print the credential file, paste tokens into source, or log login bodies.
Fake demo emails are not real delivery addresses. Credentials are random per local
target and must never be used in production.

## Customer profile, catalog, and plans

```powershell
$profile = Invoke-RestMethod -Uri "$baseUrl/api/v1/customers/me" -Headers $customerHeaders
$updated = Invoke-RestMethod -Method Patch -Uri "$baseUrl/api/v1/customers/me" `
    -Headers $customerHeaders -ContentType 'application/json' `
    -Body (@{ display_name = 'Demo reviewer'; company = 'Example Studio' } | ConvertTo-Json)
$plans = Invoke-RestMethod -Uri "$baseUrl/api/v1/plans?billing_interval=monthly&limit=20&sort=name" -Headers $customerHeaders
$plan = $plans.items | Where-Object name -eq 'DEMO Monthly' | Select-Object -First 1
$variants = Invoke-RestMethod -Uri "$baseUrl/api/v1/products/$($plan.product_id)/variants" -Headers $customerHeaders
$variant = $variants.items | Where-Object kind -eq 'variant' | Select-Object -First 1
$products = Invoke-RestMethod -Uri "$baseUrl/api/v1/products?limit=20" -Headers $staffHeaders
```

Expected 200 safe profile, update, paginated plans/variants/products. Profile update
changes only supplied fields. Customer plans omit internal cost. Staff product data
includes cost. Try /products with customer headers: 403; without headers: 401.
Another customer's /customers/{id}: 404. Supplying role/is_active/cost to the customer
PATCH: 422. Archived/unavailable plans cannot create new quotations (409).

To create a separate fake product as staff:

```powershell
$productBody = @{ name = "Manual Example $([Guid]::NewGuid())"; type = 'software'; sales_price = '100.00'; cost = '20.00'; currency = 'USD' } | ConvertTo-Json
$product = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/products" -Headers $staffHeaders -ContentType 'application/json' -Body $productBody
```

Expected 201 ProductResponse. Retry identical name: 409. Negative cost/price: 422.
Customer request: 403. Product DELETE as staff archives it, returns 204 and preserves
history. Plan/template/tax/discount examples and all schemas are in the API guide.
Tax/discount creation is admin-only; staff writes return 403. Invalid rate >100
or percentage >100 returns 422. Duplicate code/name returns 409.

## Quotation → subscription → invoice

The following creates new records owned by the logged-in demo customer. It does
not modify seeded agreements. Use unmodified demo catalog/rules for the example totals.

```powershell
$utcDate = [DateTime]::UtcNow.ToString('yyyy-MM-dd')
$quoteBody = @{
    lines = @(@{ plan_id = $plan.id; quantity = 2; variant_ids = @($variant.id) })
    start_date = $utcDate
    discount_code = 'DEMO10'
    notes = 'Explicit manual demonstration'
} | ConvertTo-Json -Depth 6
$quote = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/quotations" -Headers $customerHeaders -ContentType 'application/json' -Body $quoteBody
$issued = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/quotations/$($quote.id)/actions/issue" -Headers $customerHeaders
$confirmed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/quotations/$($quote.id)/actions/confirm" -Headers $customerHeaders
$subscription = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions" -Headers $customerHeaders `
    -ContentType 'application/json' -Body (@{ quotation_id = $quote.id } | ConvertTo-Json)
$active = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/actions/activate" -Headers $customerHeaders
$invoiceBody = @{ period_start = $active.next_billing_date } | ConvertTo-Json
$invoice = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/invoices" `
    -Headers $staffHeaders -ContentType 'application/json' -Body $invoiceBody
$invoiceRetry = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/invoices" `
    -Headers $staffHeaders -ContentType 'application/json' -Body $invoiceBody
$confirmedInvoice = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/invoices/$($invoice.id)/confirm" -Headers $staffHeaders
```

Expected quote/subscription/invoice creation 201, actions 200. The quote progresses
draft→quotation→confirmed→active, and subscription confirmed→active. Default demo
pricing is 2 × (90+10), discount 20, tax 18, total 198.00 if the discount remains
eligible. Quote previews do not reserve usage. Read invoice.discount_snapshot for
the applied eligibility reason. Invoice retry must have the same ID and only one
period advance. Duplicate subscription conversion returns the same subscription.

Invalid scenarios: confirm a draft quote without issuing it (409); edit an issued
quote (409); add unit_price to line input (422); submit customer_id as customer (403);
select an invalid/archived variant or too-small quantity (409); issue an expired
quote (409). Anonymous requests return 401. Using otherHeaders for quote/subscription/
invoice IDs returns 404 and their lists exclude these records. Customer invoice
generation/confirmation returns 403. Skipping next_billing_date returns 409; timestamp
input or an invalid issue/due range returns 422.

## Manual payments and finance

```powershell
$paymentHeaders = @{ Authorization = $staffHeaders.Authorization; 'Idempotency-Key' = [Guid]::NewGuid().ToString() }
$paymentBody = @{ invoice_id = $invoice.id; amount = '50.00'; method = 'bank_transfer'; payment_date = $utcDate; notes = 'Manual example' } | ConvertTo-Json
$payment = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/payments" -Headers $paymentHeaders -ContentType 'application/json' -Body $paymentBody
$paymentRetry = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/payments" -Headers $paymentHeaders -ContentType 'application/json' -Body $paymentBody
$balance = Invoke-RestMethod -Uri "$baseUrl/api/v1/invoices/$($invoice.id)" -Headers $customerHeaders
$metrics = Invoke-RestMethod -Uri "$baseUrl/api/v1/dashboard?currency=USD&customer_id=$($profile.id)" -Headers $staffHeaders
$report = Invoke-RestMethod -Uri "$baseUrl/api/v1/reports/revenue?currency=USD&granularity=month" -Headers $staffHeaders
$overdue = Invoke-RestMethod -Uri "$baseUrl/api/v1/invoices?status=overdue&limit=20" -Headers $staffHeaders
```

Expected payment 201 and retry 201 with the same ID, not a second balance deduction.
For the 198.00 example, balance becomes 148.00. Record the exact remaining amount
with a **new** idempotency key to settle; invoice becomes paid and balance zero.
Dashboard cash increases only by recorded payments. Seeded history also contributes
to aggregates; date/customer/currency filters narrow the relevant flows.

Invalid scenarios: missing Idempotency-Key (422), changed body with same key (409),
duplicate non-null reference (409), overpayment (409), zero/negative amount (422),
future/pre-issue payment date (422/409), draft invoice (409). Customer writes/finance
dashboard return 403; foreign payment retrieval returns 404; no token returns 401.
Concurrent same-period invoices or same-key payments must produce one record; the
automated concurrency suite exercises independent PostgreSQL connections. Run it:

```powershell
& .\.venv\Scripts\python.exe -m pytest -q --run-db tests/test_financial_concurrency.py
```

## Pause, resume, close, renew, and errors

```powershell
$paused = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/actions/pause" -Headers $customerHeaders
$resumed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/actions/resume" -Headers $customerHeaders
$closed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/actions/close" -Headers $customerHeaders
$renewed = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/subscriptions/$($subscription.id)/renew" `
    -Headers $customerHeaders -ContentType 'application/json' -Body (@{ start_date = $utcDate } | ConvertTo-Json)
```

Expected actions 200, renewal 201 with a new confirmed subscription at current
catalog prices. Retry same renewal: same ID; conflicting dates: 409. A closed
subscription cannot reactivate. Pause retains the billing anchor and backlog;
there is no proration. Other customers cannot perform these actions (404).

Inspect failed requests without displaying credential variables:

```powershell
try {
    Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/me" -Headers @{ Authorization = 'Bearer deliberately-invalid' }
} catch {
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
```

Expected 401 error envelope. Logs contain JSON fields timestamp/level/logger/message
and safe failure summaries. Do not paste raw environment/configuration or login
responses into bug reports. End the customer session and clear local secrets:

```powershell
Invoke-RestMethod -Method Post -Uri "$baseUrl/api/v1/auth/logout" -Headers $customerHeaders
Clear-Variable demoAccounts, adminHeaders, staffHeaders, customerHeaders, otherHeaders, paymentHeaders -ErrorAction SilentlyContinue
```

Subsequent use of that customer token must return 401. Other sessions expire normally.
These manual records remain deliberately: there is no reset/delete-history step.
Demo reruns preserve them and do not repair reviewer changes. Request a reviewed,
explicitly scoped cleanup if necessary. Never drop/truncate databases or delete volumes.
