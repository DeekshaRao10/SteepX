# SteepX API contract — Phases 1–8

Base URL for local development: http://localhost:8000. Versioned prefix: /api/v1.
Schemas are generated at /openapi.json, with /docs and /redoc interfaces.
Examples below use fake data/placeholders; they are not captured real credentials.
See [current verification results](phase-3-to-8-verification.md) for observed outcomes.

## Endpoints

| Method | Path | Authorization | Success |
| --- | --- | --- | --- |
| GET | /api/v1/health | Public | 200 |
| POST | /api/v1/auth/register | Public; role fixed to customer | 201 |
| POST | /api/v1/auth/login | Public credentials exchange | 200 |
| GET | /api/v1/auth/me | Active user with valid bearer token/session | 200 |
| POST | /api/v1/auth/logout | Active user with valid bearer token/session | 204 |
| POST | /api/v1/staff | Admin only | 201 |
| GET | /openapi.json, /docs, /redoc | Public | 200 |

No public admin registration/bootstrap, update-role, disable-user, or list-users
endpoint exists. The complete business catalog and its schemas appear below.

## Registration

POST /api/v1/auth/register, Content-Type: application/json. No Authorization required.

~~~json
{"email":"customer@example.com","password":"ExampleOnly!902"}
~~~

The example password is fake and must not be reused. Input permits exactly email
and password. Supplying role (including customer), is_active, IDs, or other fields
returns 422. The service assigns customer itself.

Emails are trimmed, validated without a deliverability lookup, normalized to
lowercase, and stored with an ASCII local part and IDNA domain. Internationalized
local parts are not supported. A database normalization check and unique constraint
protect against bypasses and concurrent duplicate requests.

Passwords are 9–128 characters and must contain uppercase, lowercase, and at least
one character that is neither alphanumeric nor whitespace. They are not trimmed
or normalized. Hashing uses Argon2id with a fresh salt through pwdlib.

Expected 201 response shape (UUID/timestamps are illustrative):

~~~json
{
  "id":"11111111-1111-4111-8111-111111111111",
  "email":"customer@example.com",
  "role":"customer",
  "is_active":true,
  "created_at":"2026-10-31T12:00:00Z",
  "updated_at":"2026-10-31T12:00:00Z"
}
~~~

This UserResponse is also used by /auth/me and staff creation. Neither password
nor password_hash is present. Registration does not log in the customer or issue a token.
Invalid input/malformed JSON: 422. Duplicate normalized email: 409 with
registration_conflict. No conflicting account's identity/role is returned.
The distinct 409 status still reveals email availability; rate limiting and email
verification are pending before public deployment.

## Login

POST /api/v1/auth/login, JSON body with the same email/password fields, no role.
Email normalization matches registration. Login accepts existing credentials without
reapplying the registration complexity policy; empty, missing, non-string, or
overlong passwords are invalid input.

~~~json
{"email":"customer@example.com","password":"ExampleOnly!902"}
~~~

Expected 200 shape:

~~~json
{"access_token":"<ACCESS_TOKEN>","token_type":"bearer","expires_in":1800}
~~~

expires_in is seconds, determined by ACCESS_TOKEN_EXPIRE_MINUTES. Responses are
marked Cache-Control: no-store, with Pragma: no-cache for login. Do not print the
login response, store tokens in source control, or send tokens in URLs.

Incorrect password, unknown email, and disabled account all return the same 401
code/message. A dummy Argon2 verification is used for unknown accounts; this is
not a guarantee of identical network timing. Malformed/missing input returns 422.

## Bearer tokens and current user

Send `Authorization: Bearer <ACCESS_TOKEN>`.

GET /api/v1/auth/me returns the authenticated account's UserResponse. It accepts
no customer/user selector; identity is derived from the signed sub claim and a
server-side account/session lookup. Supplying a different user_id query parameter
does not change which account is returned.

JWTs use the configured HS256 allowlist and require signature, issuer, audience,
sub, jti, iat, nbf, exp, and token_type=access. UUID claims and timestamp types/lifetime
are checked. The server never trusts an arbitrary algorithm or role from a token.
The role and active status are read from PostgreSQL on each authenticated request.
The matching stored session must exist, be unrevoked, and have the token's expiry.

Missing/malformed bearer headers, invalid signature, expired/future/invalid claims,
missing/revoked sessions, and disabled users return 401 with WWW-Authenticate: Bearer.
There are no refresh tokens; log in again after expiry. Changing the signing key
invalidates all previous tokens.

## Logout

POST /api/v1/auth/logout requires a valid bearer token and no body.
Expected 204 with an empty response body. It revokes only the current login session
in a database transaction. Other sessions for that account remain active.

A subsequent request with that token, including a repeated logout, returns 401.
No new session is created by a retry. Revocation affects subsequent authentication;
it does not cancel another request that already passed authorization in flight.

## Admin-only staff creation

POST /api/v1/staff, with an admin bearer token and application/json:

~~~json
{"email":"staff@example.com","password":"ExampleOnly!902"}
~~~

Same email/password rules as registration. Role is fixed to staff by the service.
Expected 201 UserResponse with role=staff. Anonymous: 401. Staff/customer: 403.
Duplicate email: 409. Role injection or invalid body: 422. An admin cannot use this
endpoint to create another admin. Granular staff permissions and staff editing
are not implemented.

The first admin is created only through the interactive local bootstrap CLI
documented in [README](../README.md). Existing customers are never promoted by it.

## Reusable role and ownership policies

| Dependency | Admin | Staff | Customer |
| --- | --- | --- | --- |
| get_current_user | Allowed | Allowed | Allowed |
| require_admin | Allowed | 403 | 403 |
| require_operator | Allowed | Allowed | 403 |
| require_customer | 403 | 403 | Allowed |

Every dependency rejects missing/invalid authentication with 401. Role permissions
are explicit allowlists; admin is not implicitly permitted on a customer-only
operation. There are no artificial production demonstration endpoints.

Customers can view/update their own profile, browse available plans and variants,
manage their own quotations and subscriptions, and read their own invoices/payments.
Foreign customer resources return 404, including attempts through lists or related
IDs. Customers must omit customer_id on quotation creation/update: the server
derives it from the authenticated account, and a submitted selector returns 403.
Staff/admin can operate across customers but must explicitly select customer_id
when writing quotations. Customers cannot set prices, taxes, discounts, role,
active flags, balances, payment records, or arbitrary lifecycle states.

## Error envelope

~~~json
{
  "error":{
    "code":"unauthenticated",
    "message":"Invalid credentials or access token.",
    "details":[]
  }
}
~~~

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | bad_request / cors_not_allowed | Invalid request or rejected CORS preflight |
| 401 | unauthenticated | Invalid credentials/authentication/session |
| 403 | forbidden | Authenticated role denied |
| 404 | not_found | Unknown/inaccessible route or resource |
| 405 | method_not_allowed | Unsupported HTTP method |
| 409 | registration_conflict / conflict | Account, uniqueness, dates, balance or lifecycle conflict |
| 422 | validation_error | Missing, invalid, extra, or malformed input |
| 500 | internal_server_error | Unexpected failure; internal details hidden |

Validation details are arrays of objects with location (strings/indices), code,
and a safe message. A password_policy message explains the 9–128 character and
character-class requirements. Submitted values, raw validator text, context,
database errors, and stack traces are omitted. Framework headers such as Allow
and WWW-Authenticate are retained. Generic 429/503 handlers do not imply rate
limiting or a database-readiness endpoint exists.

## Health and CORS compatibility

GET /api/v1/health still returns:

~~~json
{"status":"ok","service":"Brightloop Subscription API"}
~~~

It is liveness only and makes no database query. Syntactically valid application
settings are still necessary to start the server.

CORS defaults to http://localhost:3000 and is configurable. Successful preflights
return 200 plain-text OK; rejected preflights return a 400 JSON error. Ordinary
requests from unapproved origins may reach the API, but omit the corresponding
Access-Control-Allow-Origin header. CORS is not authorization.

Permitted methods: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS. Permitted explicit
headers include Authorization, Content-Type, Accept, Idempotency-Key. Allowing a
method/header does not implement an endpoint or write-idempotency feature.

## Password reset, delivery, and other deferred security work

No reset, refresh-token, or email-delivery endpoint is implemented. The intended
reset design is a short-lived random, single-use token whose hash and expiry are
stored server-side; the request response must not reveal whether an email exists.
Consuming it must atomically change the Argon2 password hash, invalidate the reset
token, and revoke prior login sessions. A configured delivery provider, rate limits,
and reviewed reset contract are prerequisites; no email delivery is implied now.

Email verification, distributed abuse controls, deployment TLS/proxy policy,
session retention, and granular staff management remain future work. Isolated demo
seeding is available through the explicitly invoked commands in the README.

## Common business contracts

All resources use UUID IDs. Records expose created_at/updated_at as UTC timestamps.
Financial totals serialize as decimal strings with two places; rates/discount
percentages support four places. Submit money as JSON strings to preserve precision.
Dates accept only YYYY-MM-DD, not timestamps or Unix epoch values. Input schemas
forbid extra fields. PUT replaces the documented editable fields; omitted optional
fields receive their defaults. Customer PATCH changes supplied fields only.
DELETE archives supported catalog/profile/rule/template records and returns 204;
it never deletes financial history. Archived names remain reserved by uniqueness.

Collections return `{"items":[],"total":0,"limit":20,"offset":0}`. Use limit=1–100,
offset=0–1000000, sort=created_at/-created_at or name/-name (default -created_at),
and is_active where the resource supports it. UUID breaks sorting ties. q performs
case-insensitive contains matching on customer display name, product/variant/plan/
template/tax name, or discount code. Resources without a name ignore q and treat
name sorting as created_at sorting; use date/state/customer filters for financial
lists. These queries are filtered and paginated in PostgreSQL, with batched line loading.

Additional filters:

| Collection | Filters |
| --- | --- |
| plans | billing_interval=daily/weekly/monthly/yearly; customer view includes currently available active plans only |
| quotations, subscriptions | state, customer_id; customer_id never widens customer scope |
| invoices | status, customer_id, subscription_id, date_from/date_to on issue date |
| payments | invoice_id, date_from/date_to on payment date |
| dashboard | currency, customer_id, date_from/date_to for invoiced totals and cash flows |
| reports/revenue | currency, customer_id, date_from/date_to, granularity=day/month |

An empty date range is not an error; a reversed range returns 422. Report ranges
are limited to ten years. Currency filters select a ledger currency, with no FX conversion.
Dashboard balances and subscription counts describe current state regardless of
flow date filters. Revenue means recorded payments; unpaid invoices are not cash.

## Catalog and customer schemas

Customer profile: display_name, company, phone, billing_address, is_active. Its ID
is the corresponding customer user's ID. Registration creates it transactionally;
POST /customers attaches a missing profile to an existing customer user_id and
returns 409 if already present. It does not register users or change credentials.
Customers update display_name/company/phone/billing_address through /customers/me.
Staff/admin may additionally archive or change the profile active flag, which
prevents new agreements/activation without disabling account login or history access.

Example operator requests (identifiers are placeholders):

```json
{"name":"Example Workspace","type":"software","sales_price":"100.00","cost":"20.00","currency":"USD","notes":"Example","is_active":true}
```

```json
{"name":"Extra storage","kind":"addon","additional_price":"10.00","is_active":true}
```

```json
{"product_id":"<PRODUCT_ID>","name":"Monthly workspace","price":"90.00","billing_interval":"monthly","minimum_quantity":1,"end_behavior":"renew","tax_rate_id":null}
```

ProductWrite/ProductResponse include internal cost, so their endpoints are operator-only.
Customers use PlanResponse (adds product_name/currency but no cost) and VariantResponse.
Prices are nonnegative, at most 999999999.99, with at most two decimal places.
Quantity is 1–10000. A plan's product and interval, and a product's currency, are
immutable; changes require a new catalog record. Availability boundaries are inclusive.
Plan association with an inactive tax rate is rejected. An archived product blocks new agreements.

## Quotations, templates, and subscriptions

QuotationWrite example for a customer:

```json
{"lines":[{"plan_id":"<PLAN_ID>","quantity":2,"variant_ids":["<VARIANT_ID>"]}],"valid_until":"2027-01-31","start_date":"2027-01-01","notes":"Example request","discount_code":"EXAMPLE10"}
```

Dates are illustrative; use valid current dates. Operators add customer_id and
may backdate. Customers cannot backdate. Choose lines OR template_id. TemplateWrite
has name, notes, selections (same shape as lines), validity_days=1–365, is_active.
Templates preserve selections; each use prices the current catalog. Lines are
limited to 50 and selections to 20 per line, with at most one variant and multiple
add-ons. Every selection must belong to the plan's product. All lines must share
currency, interval, and end behavior. Client prices/taxes are rejected as extra fields.

QuotationResponse contains customer_id, state, is_expired, validity/start/end dates,
currency, interval, discount/template references, notes, totals, and line snapshots.
Each snapshot includes position, plan_id, description, quantity, unit_price, tax_rate,
and selected variants (ID, name, kind, additional_price). Only draft quotes can be
replaced. Actions are issue/confirm/close; invalid transitions return 409.

POST /subscriptions accepts `{"quotation_id":"<QUOTATION_ID>"}`. It requires a
confirmed quote; repeating conversion returns the same subscription with 201.
SubscriptionResponse includes quote/renewal/customer references, effective state,
start_date, term_end, closed_on, paused_at, next_period_index, next_billing_date,
currency/interval/behavior, and agreed line snapshots.
Actions activate/pause/resume/close are explicit. Renewal accepts start_date and
optional end_date, requires a closed subscription, and produces one new confirmed
subscription at current catalog prices. Repeating identical renewal returns its ID;
conflicting dates return 409. See [business rules](business-rules.md) for closure,
end behavior, effective state, snapshot and pause semantics.

## Taxes, discounts, invoices, and payments

TaxWrite: `{"name":"Example tax","rate":"10.0000","description":"Illustrative only","is_active":true}`.
Rates range from 0 to 100. No jurisdiction is inferred. Tax and discount mutations
require admin; staff can read and use configured rules.

DiscountWrite example:

```json
{"code":"EXAMPLE10","kind":"percentage","value":"10","currency":"USD","minimum_purchase":"50.00","minimum_quantity":1,"starts_on":null,"ends_on":null,"usage_limit":100,"is_active":true}
```

Code is uppercase, 3–40 letters/digits/underscore/hyphen. Fixed discounts accept
two decimals; percentages accept four, capped at 100. Eligibility and usage are
server-controlled. DiscountResponse adds used_count. One discount may apply to an
agreement; usage is consumed when a nonzero discounted invoice is generated.

Generate an invoice (operator only):

```json
{"period_start":"2027-01-01","issue_date":"2027-01-01","due_date":"2027-01-15"}
```

Use the subscription's earliest due next_billing_date, never a future date.
issue_date defaults to today, due_date to issue_date + BILLING_DUE_DAYS. Response
includes invoice_number, customer/subscription references, period_index/start/end,
issue/due dates, effective status, currency, subtotal, discount, tax, total,
amount_paid, outstanding_balance, customer_snapshot, discount_snapshot, and lines.
Customer snapshots retain billing name/company/address/email. Discount snapshots
contain code/kind/value/eligibility (null when none); invoice lines also expose
subtotal/discount/tax/total. Generated invoices are drafts; POST /invoices/{id}/confirm
confirms them. No body required. Existing-period retries return the same invoice
with 201; explicit conflicting dates return 409. There is no invoice update/delete API.

PaymentCreate (operator only), with required UUID `Idempotency-Key` header:

```json
{"invoice_id":"<INVOICE_ID>","amount":"50.00","method":"bank_transfer","payment_date":"2027-01-02","notes":"Example manual record","reference":"EXAMPLE-001"}
```

Methods are cash/bank_transfer/check/other. Amount must be positive and at most the
outstanding balance; confirm the invoice first. Payment date cannot precede issuance
or be in the future. PaymentResponse exposes ID/timestamps, invoice_id, recorded_by,
amount/method/date/notes/reference. It never exposes the request fingerprint or key.
Same key + same normalized body returns the same record with 201. Same key + changed
body returns 409. A non-null reference is unique within its invoice. Different keys
represent different payment intentions; reuse the original key after network failures.
Payments are immutable; refunds, credits, reversal and overpayment are not implemented.

## Complete versioned endpoint catalog

The generated table below names the exact request/response models in
[OpenAPI](openapi.json). Fields, requiredness, limits and enums are authoritative
there. All unspecified request schemas mean no JSON body. “Authenticated” includes
server-enforced ownership where applicable, not access to other customers' records.
Standard errors are 401 (missing/invalid token), 403 (role), 404 (missing/inaccessible),
409 (business conflict), and 422 (invalid input). GET and updates return 200,
creation/retries return 201, and archive/logout return 204. Framework documentation
at /docs, /redoc and /openapi.json remains public.

<!-- endpoint-catalog:start -->

| Method | Path | Authorization | Request model | Success / response model |
| --- | --- | --- | --- | --- |
| GET | /api/v1/health | Public | — | 200 / HealthResponse |
| POST | /api/v1/auth/register | Public | RegisterRequest | 201 / UserResponse |
| POST | /api/v1/auth/login | Public | LoginRequest | 200 / TokenResponse |
| GET | /api/v1/auth/me | Authenticated; ownership applies | — | 200 / UserResponse |
| POST | /api/v1/auth/logout | Authenticated; ownership applies | — | 204 / — |
| POST | /api/v1/staff | admin | RegisterRequest | 201 / UserResponse |
| GET | /api/v1/customers/me | Authenticated; ownership applies | — | 200 / CustomerResponse |
| PATCH | /api/v1/customers/me | Authenticated; ownership applies | CustomerUpdate | 200 / CustomerResponse |
| GET | /api/v1/customers | admin, staff | — | 200 / Page_CustomerResponse_ |
| POST | /api/v1/customers | admin, staff | CustomerCreate | 201 / CustomerResponse |
| GET | /api/v1/customers/{customer_id} | Authenticated; ownership applies | — | 200 / CustomerResponse |
| PATCH | /api/v1/customers/{customer_id} | admin, staff | CustomerAdminUpdate | 200 / CustomerResponse |
| DELETE | /api/v1/customers/{customer_id} | admin, staff | — | 204 / — |
| GET | /api/v1/products | admin, staff | — | 200 / Page_ProductResponse_ |
| POST | /api/v1/products | admin, staff | ProductWrite | 201 / ProductResponse |
| GET | /api/v1/products/{product_id} | admin, staff | — | 200 / ProductResponse |
| PUT | /api/v1/products/{product_id} | admin, staff | ProductWrite | 200 / ProductResponse |
| DELETE | /api/v1/products/{product_id} | admin, staff | — | 204 / — |
| GET | /api/v1/products/{product_id}/variants | Authenticated; ownership applies | — | 200 / Page_VariantResponse_ |
| POST | /api/v1/products/{product_id}/variants | admin, staff | VariantWrite | 201 / VariantResponse |
| PUT | /api/v1/products/{product_id}/variants/{variant_id} | admin, staff | VariantWrite | 200 / VariantResponse |
| DELETE | /api/v1/variants/{variant_id} | admin, staff | — | 204 / — |
| GET | /api/v1/plans | Authenticated; ownership applies | — | 200 / Page_PlanResponse_ |
| POST | /api/v1/plans | admin, staff | PlanWrite | 201 / PlanResponse |
| GET | /api/v1/plans/{plan_id} | Authenticated; ownership applies | — | 200 / PlanResponse |
| PUT | /api/v1/plans/{plan_id} | admin, staff | PlanWrite | 200 / PlanResponse |
| DELETE | /api/v1/plans/{plan_id} | admin, staff | — | 204 / — |
| GET | /api/v1/quotation-templates | Authenticated; ownership applies | — | 200 / Page_TemplateResponse_ |
| POST | /api/v1/quotation-templates | admin, staff | TemplateWrite | 201 / TemplateResponse |
| GET | /api/v1/quotation-templates/{template_id} | Authenticated; ownership applies | — | 200 / TemplateResponse |
| PUT | /api/v1/quotation-templates/{template_id} | admin, staff | TemplateWrite | 200 / TemplateResponse |
| DELETE | /api/v1/quotation-templates/{template_id} | admin, staff | — | 204 / — |
| GET | /api/v1/quotations | Authenticated; ownership applies | — | 200 / Page_QuotationResponse_ |
| POST | /api/v1/quotations | Authenticated; ownership applies | QuotationWrite | 201 / QuotationResponse |
| GET | /api/v1/quotations/{quotation_id} | Authenticated; ownership applies | — | 200 / QuotationResponse |
| PUT | /api/v1/quotations/{quotation_id} | Authenticated; ownership applies | QuotationWrite | 200 / QuotationResponse |
| POST | /api/v1/quotations/{quotation_id}/actions/{action} | Authenticated; ownership applies | — | 200 / QuotationResponse |
| GET | /api/v1/subscriptions | Authenticated; ownership applies | — | 200 / Page_SubscriptionResponse_ |
| POST | /api/v1/subscriptions | Authenticated; ownership applies | SubscriptionCreate | 201 / SubscriptionResponse |
| GET | /api/v1/subscriptions/{subscription_id} | Authenticated; ownership applies | — | 200 / SubscriptionResponse |
| POST | /api/v1/subscriptions/{subscription_id}/actions/{action} | Authenticated; ownership applies | — | 200 / SubscriptionResponse |
| POST | /api/v1/subscriptions/{subscription_id}/renew | Authenticated; ownership applies | RenewalRequest | 201 / SubscriptionResponse |
| GET | /api/v1/tax-rates | admin, staff | — | 200 / Page_TaxResponse_ |
| POST | /api/v1/tax-rates | admin | TaxWrite | 201 / TaxResponse |
| GET | /api/v1/tax-rates/{rate_id} | admin, staff | — | 200 / TaxResponse |
| PUT | /api/v1/tax-rates/{rate_id} | admin | TaxWrite | 200 / TaxResponse |
| DELETE | /api/v1/tax-rates/{rate_id} | admin | — | 204 / — |
| GET | /api/v1/discounts | admin, staff | — | 200 / Page_DiscountResponse_ |
| POST | /api/v1/discounts | admin | DiscountWrite | 201 / DiscountResponse |
| GET | /api/v1/discounts/{discount_id} | admin, staff | — | 200 / DiscountResponse |
| PUT | /api/v1/discounts/{discount_id} | admin | DiscountWrite | 200 / DiscountResponse |
| DELETE | /api/v1/discounts/{discount_id} | admin | — | 204 / — |
| POST | /api/v1/subscriptions/{subscription_id}/invoices | admin, staff | InvoiceGenerate | 201 / InvoiceResponse |
| GET | /api/v1/invoices | Authenticated; ownership applies | — | 200 / Page_InvoiceResponse_ |
| GET | /api/v1/invoices/{invoice_id} | Authenticated; ownership applies | — | 200 / InvoiceResponse |
| POST | /api/v1/invoices/{invoice_id}/confirm | admin, staff | — | 200 / InvoiceResponse |
| POST | /api/v1/payments | admin, staff | PaymentCreate | 201 / PaymentResponse |
| GET | /api/v1/payments | Authenticated; ownership applies | — | 200 / Page_PaymentResponse_ |
| GET | /api/v1/payments/{payment_id} | Authenticated; ownership applies | — | 200 / PaymentResponse |
| GET | /api/v1/dashboard | admin, staff | — | 200 / DashboardResponse |
| GET | /api/v1/reports/revenue | admin, staff | — | 200 / RevenueReport |

<!-- endpoint-catalog:end -->
