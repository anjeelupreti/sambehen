# Sambehen — Architecture Notes

Companion to `IMPLEMENTATION_PLAN.md`. That file describes what was built;
this one records the decisions a new contributor most needs to know before
changing anything, and why they are the way they are.

---

## 1. Scoping is the security boundary

`ScopeService` decides which rows an actor may see. Every list, detail,
mutation, metric and export composes a predicate from it, in the **data
layer** — not in a controller check that a new endpoint could forget.

| Actor   | Sees                                                           |
| ------- | -------------------------------------------------------------- |
| master  | everything; may narrow by any `managerId` / `runnerId`         |
| manager | `customers.manager_id = self`; may narrow to their own runners |
| runner  | `customers.runner_id = self`; no narrowing                     |

Two rules that must survive any refactor:

**Predicates are SQL, never materialised id lists.** An id list does not
scale and truncates silently. A scope that quietly returns fewer rows is a
correctness bug; one that quietly returns _more_ is a breach.

**Row denial is 404, never 403.** A 403 confirms that a record in another
manager's chain exists, which is precisely what scoping hides. 403 is
reserved for capability denials — where the action is refused regardless
of which row it targets.

An unknown role falls through to `false`, not to "no predicate", so a role
added later without touching `ScopeService` denies by default.

### Ownership denormalisation

`customers` stores ownership three ways: `ownerStaffId` (truth), plus
`managerId` and `runnerId` (denormalised). That lets scope be one indexed
equality rather than a recursive join, which matters because every list in
the system composes it.

The denormalisation is only safe because `CustomerAssignmentService` is the
sole writer, and a CHECK constraint enforces the invariant independently.
**Never set those columns directly.**

---

## 2. Money

- Stored as `numeric(18,2)`. Never float.
- Serialised as **strings** in JSON, so JavaScript's float parsing cannot
  corrupt a balance in transit.
- Aggregated in SQL, where postgres does exact decimal arithmetic.
- `Money` (`common/utils/money.util.ts`) works in integer minor units for
  the few comparisons the service layer must do — chiefly capping a
  correction against its parent.
- Written to spreadsheets as **numeric cells**, not strings, so the
  recipient can `SUM()` the column.

### The transaction semantics everything depends on

```
debit  = money IN from the customer
credit = money OUT to the customer

a credit carrying parentTransactionId is a CORRECTION, not a withdrawal

total_spent     = SUM(amount) WHERE type='debit'
total_withdrawn = SUM(amount) WHERE type='credit' AND parent_transaction_id IS NULL
net             = SUM(debit) - SUM(credit)
```

Counting corrections as withdrawals is the easiest way to misreport what a
customer actually took out. A CHECK constraint enforces that a correction
is always a credit, and a partial index serves the withdrawal aggregate
specifically.

Amount, type and customer are **immutable** after entry: changing them
would silently rewrite aggregates that have already been reported. A wrong
amount is fixed with a correction, which leaves a trail.

---

## 3. Two auth realms

Team and customer tokens are signed with **different secrets**. That is
what makes cross-realm replay structurally impossible: a customer token on
a team route fails signature verification, rather than relying on a claim
check a forged payload could satisfy.

`TeamJwtGuard` is registered globally, so routes are authenticated by
default and must opt out with `@Public()` or `@CustomerAuth()`. Failing
closed means a new controller cannot ship unauthenticated by accident.

`@CustomerAuth()` also sets a realm marker. Global guards run _before_
route guards, so without it the team guard would reject customer tokens
before `CustomerJwtGuard` ever ran — this shipped broken once and is now
covered by `realm-routing.spec.ts`.

---

## 4. The response contract

One envelope everywhere: `success`, `statusCode`, `message`, `data`
(success only), `error` (failure only), `meta` + `summary` (lists),
`timestamp`, `path`, `correlationId`.

`error.code` comes from a central enum and is **contractual** — clients
switch on it, so a code is never reworded once shipped. `message` is
human-facing and may change freely.

Exports are the sole exception: they stream binary and opt out with
`@RawResponse()`. Errors raised _before_ the stream opens still return the
normal JSON envelope.

`summary` on a list is always a **second aggregate over the same WHERE
clause**, never a reduction over the current page. "43 unread" is only
useful if it describes the whole inbox.

---

## 5. Background work

No external broker. Two mechanisms:

- **`@Cron` jobs** — VIP drift recompute, spin status transitions, email
  dispatch.
- **`@OnEvent`** — `TransactionCreated` drives VIP re-evaluation and
  referral reward settlement.

Both event handlers **swallow their own errors**. VIP standing and bonus
accounting are derived data; failing to update them must never fail the
data entry a staff member just performed. The nightly recompute repairs
whatever is missed.

### The email queue

`email_campaign_recipients` _is_ the queue. Rows are claimed with
`FOR UPDATE SKIP LOCKED`, which gives durability across restarts, full
visibility in plain SQL, no extra infrastructure, and correctness if a
second instance is ever added.

Idempotency matters most in referral payouts: a conditional status
transition plus a unique index on `(referral_id, reason)`. Paying a bonus
twice is money gone and undetectable later without hand reconciliation.

### Shutdown

`main.ts` calls `enableShutdownHooks()`, so SIGTERM runs `app.close()`.
For that to mean anything, **every long-lived handle must be closed by a
lifecycle hook** — otherwise the event loop stays alive, the process never
exits, and the orchestrator SIGKILLs it with requests still in flight.

Two hazards, both of which have bitten this codebase:

- A **factory provider has nowhere to hang a hook.** The pg pool is
  therefore its own provider (`PG_POOL`) with a small `DatabaseLifecycle`
  class to end it; drizzle wraps a pool but cannot close one.
- **`onModuleDestroy` can run without `onModuleInit`.**
  `NestFactory.create()` builds the graph but only `init()`/`listen()`
  fires init hooks, while `close()` always fires destroy hooks. Anything
  that builds the app without serving it — the openapi.json script — lands
  there. Destroy hooks must tolerate a field their init hook never set.

---

## 6. Per-viewer unread

Unread cannot be a column on a conversation. A runner, their manager and
the master all read the same thread independently, so a message the runner
has answered is still unread for the master.

`conversation_read_states` holds one marker per staff member per
conversation, and every unread figure is computed against the **current
viewer's** marker. A viewer with no marker has read nothing — the right
answer for a manager opening an inbox for the first time.

---

## 7. Index design

Verified with `EXPLAIN ANALYZE` against 108k transactions.

| Query                      | Plan                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| single-customer history    | Index Scan Backward on `idx_transactions_customer_occurred`              |
| withdrawals for a customer | **Index Only Scan** on `idx_transactions_withdrawals`, `Heap Fetches: 0` |
| recent-window aggregate    | Index Only Scan on `idx_transactions_type_occurred`                      |
| business-wide totals       | Seq Scan — **correct**, the query touches most of the table              |

The last row is worth understanding: a seq scan is not a defect when a
query reads 60–100% of a table. Forcing an index there would be slower.

The partial withdrawal index answers its aggregate entirely from the
index, which is exactly what it was designed for.

---

## 8. Testing

- **Unit** (`npm test`) — `ScopeService` role × resource matrix, money
  arithmetic against float hazards, the response contract, realm routing.
- **e2e** (`npm run test:e2e`) — cross-tenant denial over real HTTP against
  a real database. Requires `npm run db:seed`.

The e2e suite is the important one. Unit tests prove `ScopeService` is
correct in isolation; the e2e suite proves every endpoint actually composes
it. A scoping bug fails silently — a leaking endpoint returns 200 with
somebody else's rows and nothing looks wrong.

**When adding an endpoint that touches customer-derived data, add a
cross-tenant case for it.**

---

## 9. Local development

```bash
docker compose up -d db redis
cp .env.example .env          # then fill in four distinct JWT secrets
npm ci
npx drizzle-kit migrate
npm run db:seed
npm run start:dev
```

Seeded accounts share the password `Password123!`:
`master@sambehen.local`, `manager1@sambehen.local`, `runner11@sambehen.local`.

The seed creates two managers with two runners each on purpose: with a
single manager, a broken scope predicate that returns everything looks
identical to one that returns the right rows.

Swagger: `http://localhost:3000/api/docs` — paste the **raw** token into
Authorize, without the `Bearer ` prefix.

### Handing the API contract to the frontend

```bash
npm run docs:openapi              # writes openapi.json (69 paths)
npm run docs:openapi ./out.json   # or anywhere else
```

The file is **not** committed: a tracked copy goes stale the first time
someone changes a decorator without regenerating, and a stale contract is
worse than no contract. CI regenerates it on every run and uploads it as a
build artifact, so there is always a current copy to download.
