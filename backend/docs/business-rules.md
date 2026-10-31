# SteepX business rules and deliberate defaults

These are hackathon commercial defaults, not tax/legal/accounting certification.
They are centralized in core/billing_dates.py, core/lifecycle.py and the pricing,
discounts, commerce, billing, payments and finance services. No external charges occur.

## Identity and permissions

- Every customer profile shares its user UUID. Ownership filters come from the
  authenticated account, never a submitted selector. Foreign records return 404.
- Customers manage their own agreements and read their own financial history.
  Operators (staff/admin) manage catalog and customer operations and record payments.
  Only admins edit tax/discount rules and create staff. Staff permissions are role-wide.
- Archiving catalog/profile/rule records is a soft change. It does not erase history.
  Account disabled status independently rejects tokens and login. A profile archive
  blocks new agreements and activation but preserves history access.

## Agreements and state

Quotation states are draft → quotation → confirmed → active → closed. Only drafts
are editable. Issue/confirm check valid_until against the UTC date; the end date
is inclusive. Expiration is reported without mutating GET requests. Confirmation
accepts the quote snapshots. A unique quotation reference allows one subscription.

Subscription states are confirmed → active, active ↔ paused, and any open state
→ closed. Closed records cannot be reopened. Renewal creates one separate confirmed
subscription at current catalog prices, starting today or later; a unique parent
reference makes repeat renewal safe. Identical lifecycle retries are harmless;
invalid transitions return 409. Renewed terms get a fresh billing anchor.

Customers may perform these actions only on their own resources. Operators may
backdate agreements for legitimate historical records; customers may not. An
activation cannot precede its start or follow its term end and rechecks catalog
availability/customer active status without changing agreed prices.

All lines share currency, interval and end behavior. Plan price is the recurring
base; product sales_price/cost are catalog metadata, not an extra recurring charge.
Selected variant/add-on prices are added per unit. A line allows at most one variant
plus add-ons, all from the same product. The plan minimum applies per line.

`end_behavior=renew` continues anchored periods until explicit closure or end_date;
it does not silently create new subscription records or run a renewal job.
`end_behavior=close` defaults to one period when no end_date is supplied. Explicit
end_date is an exclusive bound. Active/paused subscriptions at term_end are reported
as effectively closed in detail/list/dashboard queries. The stored state changes
on an explicit closure or renewal action. The quotation records its last explicit
lifecycle event; natural term expiry alone does not rewrite its stored active state.

Pause defers invoice generation. It does **not** shift billing dates, prorate,
refund or forgive charges. Resume exposes the same earliest unbilled period. A
closed subscription can still invoice periods that began before closure/term_end.
Closing on its start date makes the unstarted period ineligible. Closing does not
alter an already issued invoice. Customers cannot edit financial snapshots.

## Calendar and billing schedule

Business dates are UTC calendar dates in YYYY-MM-DD format. Timestamp/offset/epoch
inputs are rejected, so browser timezone conversion cannot silently move a date.
Audit fields are timezone-aware timestamps. Daily/weekly mean one/seven calendar
days; monthly/yearly are calendar periods, not fixed durations in seconds.

Every boundary is calculated from the original start_date and period index:

| Anchor / interval | Subsequent boundaries |
| --- | --- |
| 2024-01-31 monthly | 2024-02-29, 2024-03-31 |
| 2023-01-30 monthly | 2023-02-28, 2023-03-30 |
| 2024-02-29 yearly | 2025-02-28, 2026-02-28, 2028-02-29 at index 4 |
| 2023-02-28 yearly | 2024-02-29 (true month-end remains month-end) |

Periods are `[period_start, period_end)`. Billing is allowed once a period starts;
there is no advance billing for future starts. Generation requires the exact earliest
next_billing_date and advances the pointer with the invoice in one transaction.
Catch up one period at a time; callers cannot skip periods. Row locks serialize
generation and PostgreSQL unique constraints protect subscription/period start/index.
Retries return the original invoice; they do not consume discount usage twice.

An end/closure inside the period clips period_end, with a **full period charge**.
No proration is implemented. Operators should review dates before confirming an
invoice. There is no scheduler, credit note, invoice cancellation or destructive reset.

## Decimal arithmetic, discounts, taxes

Money uses Decimal and NUMERIC(20,2), never binary float calculations. Amounts
are nonnegative, rounded to cents with ROUND_HALF_UP. Rates support four decimals.
Each invoice has one three-letter uppercase currency. There is no currency exchange
and no assumption that every currency follows its real-world minor-unit convention;
this implementation consistently uses two decimals for the hackathon contract.

Calculation order:

1. Each line subtotal = agreed unit price × integer quantity.
2. Calculate one eligible invoice discount: fixed amount or percentage of subtotal,
   capped at subtotal. Round its total to cents.
3. Allocate discount cents proportionally to line subtotals using largest remainder;
   equal remainders break by stable line position. Allocation exactly equals total discount.
4. Calculate each line's tax on its discounted subtotal, rounded HALF_UP to cents.
5. Sum line taxes. Total = subtotal − discount + tax. Balance = total − amount_paid.

Example: 2 × (100 + 10) = 220.00; 10% discount = 22.00; 10% tax on 198.00 = 19.80;
total = 217.80. A 50.00 payment leaves 167.80. Rounding is per line, not on combined tax.

One configurable tax rate applies per plan; no association means zero tax. Rates
are illustrative and not jurisdiction-specific. Prices, line descriptions, selected
variants and tax percentages are snapshotted on quotation acceptance and copied
to the subscription/invoice. Later catalog/tax edits cannot change historical invoices.
Customer billing details are snapshotted when generating the invoice.

A single discount code can attach to an agreement. Eligibility requires an active
rule, matching currency, period start within inclusive dates, minimum purchase and
quantity, and remaining global usage. Quote preview does not reserve usage. Each
nonzero discounted invoice consumes one use during generation (including drafts),
using a locked rule plus a unique usage record. Concurrent subscribers cannot
exceed a global limit. A later ineligible discount becomes zero with an eligibility
reason in the invoice snapshot; billing itself continues. Rule edits affect future
invoices only. Existing invoice values never recalculate. Discounts do not stack.

## Invoices, payments, metrics

Invoice number comes from a unique database identity, rendered INV-00000001.
Sequence gaps after failures are expected; numbering is not jurisdictionally certified.
Generation creates draft. Confirmation makes confirmed or paid if total is zero.
Overdue is derived from confirmed, due_date < today, and a positive balance; due
today is not yet overdue. Drafts are not collected revenue or outstanding issued debt.
Default payment term is BILLING_DUE_DAYS=14; explicit due_date must follow issue_date.

Only operators record manual payments, with an immutable recorded_by actor, timestamp,
amount, method, date, notes and optional reference. Invoice locks prevent overpayment;
balance and payment insert succeed or roll back together. A UUID Idempotency-Key is
globally unique. Same normalized body/key returns the original payment; different
content or an invoice/reference collision returns 409. Different keys without a
reference are distinct payment intentions and can each consume remaining balance.
No payment update/delete/refund endpoint or gateway integration exists.

Dashboard queries aggregate in PostgreSQL. Currency defaults to BILLING_CURRENCY=USD.
Invoiced total sums confirmed/paid invoices by issue date; collected revenue sums
payments by payment date. Outstanding and overdue are current balances across all
issued invoices, not restricted by revenue date filters. Subscription counts are
current effective states. Revenue reports group cash payments by day/month and omit
empty buckets. Filters never combine currencies. Indexes cover customer, subscription,
state, billing/due/issue/payment dates; lists batch-load line records. No load benchmark
or claim of unlimited scale is made.

## Local demo and remaining work

The separate admin bootstrap, explicit marked target, atomic seed receipt and generated
local-only credentials are described in the README. Reruns never delete/reset/adopt
existing data. Demo amounts and relationships were verified; see the execution report.

Before public deployment: HTTPS/proxy policy, managed secrets, email verification,
abuse controls, reviewed password recovery, backups, retention, financial correction
workflows, jurisdictional requirements and operational scheduling remain necessary.
No real payment, email, production system or frontend integration was accessed.
