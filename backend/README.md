# Sambehen — Data Entry Management System API

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.39-C5F74F?logo=drizzle&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio&logoColor=white)
![Jest](https://img.shields.io/badge/tests-87-success?logo=jest&logoColor=white)

Backend for a staffed data entry operation: a team records customer
activity, and the system derives everything else from it — spending totals,
VIP standing, referral bonuses, spin winners, campaign audiences and
dashboards.

**API only.** The frontend that consumes this lives in
[../frontend](../frontend). The contract between them is published as
OpenAPI (`npm run docs:openapi`, 69 paths / 91 operations) and browsable at
`/api/docs`.

> **Status:** all 11 build phases complete and merged. 87 unit tests and 33
> cross-tenant e2e tests, the latter against a real database. See
> [§ Project status](#project-status) for what is deliberately not done yet.

---

## What it does

Two separate login gateways:

- **Team** — `master`, `manager`, `store`. Staff do the data entry.
- **Customer** — customers can sign in and read their own record, but
  cannot change anything about themselves. Every edit, including their
  password, is made by the staff above them.

The team is a two-level chain. Master sees everything. A manager sees their
own customers and their stores'. A store sees only their own. **One
manager can neither see nor touch another manager's chain**, and the same
holds between stores.

| Capability                                          | master |   manager   |   store   |
| --------------------------------------------------- | :----: | :---------: | :-------: |
| Customers, transactions, messaging                  |  all   |  own chain  | own only  |
| Create/manage staff                                 |   ✅   | stores only |    ❌     |
| Games, VIP criteria, spin events, referral programs |   ✅   |    read     |   read    |
| Email campaigns                                     |   ✅   |     ✅      |    ❌     |
| Audit trail                                         |   ✅   |     ❌      |    ❌     |
| Exports                                             |  all   |  own chain  | own chain |

### Feature map

| Area             | What it covers                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| **Customers**    | CRUD, assignment, activation, bulk status, per-customer totals                                                 |
| **Transactions** | Debit/credit entry against a game, with corrections                                                            |
| **VIP**          | Master-defined criteria (metric, threshold, date range); qualification is computed, not typed                  |
| **Spin events**  | Scheduled against an active VIP criteria; preselected or post-draw winners                                     |
| **Referrals**    | Programs, generated codes and links, and a bonus ledger kept separate from real money                          |
| **Messaging**    | Socket.IO real-time threads, visible up the chain, recording which staff member replied                        |
| **Dashboard**    | Scoped metrics: all-time and this-month net, top games by debit and by credit                                  |
| **Email**        | Audience filters (spend, recency, city, activity) or hand-picked recipients, themed templates, queued delivery |
| **Audit**        | Append-only trail of every state-changing action; master-only, unscoped by design                              |
| **Exports**      | 14 lists to `.xlsx`, each reusing the same scoped query as its endpoint                                        |

---

## The four things to understand before changing code

Full detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). These four
cause real damage if missed.

**1. Scoping is the security boundary.** `ScopeService` returns a SQL
predicate that every list, detail, mutation, metric and export composes —
in the data layer, not in a controller check a new endpoint could forget.
Row denial is **404, never 403**: a 403 confirms the record exists, which
is exactly what scoping hides. 403 is reserved for capability denials.

**2. A credit with a parent is a correction, not a withdrawal.**

```
debit  = money IN        credit = money OUT
credit + parentTransactionId = CORRECTION of an earlier entry

total_spent     = SUM(amount) WHERE type='debit'
total_withdrawn = SUM(amount) WHERE type='credit' AND parent_transaction_id IS NULL
```

Counting corrections as withdrawals is the easiest way to misreport what a
customer actually took out. Amount, type and customer are immutable after
entry — a wrong figure is fixed with a correction, which leaves a trail.

**3. Money is `numeric(18,2)`, serialised as strings.** Never float, never
parsed into a JS number in transit. Aggregation happens in SQL.

**4. The two realms have different signing secrets.** Cross-realm replay
fails at signature verification rather than at a claim check a forged
payload could satisfy. Four secrets total: team access/refresh, customer
access/refresh.

---

## Response contract

One envelope on every route:

```jsonc
{
  "success": true,
  "statusCode": 200,
  "message": "Customers retrieved",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 },
  "summary": { "totalSpent": "48210.00" },
  "timestamp": "2026-08-03T10:12:00.000Z",
  "path": "/api/v1/team/customers",
  "correlationId": "b1f2…",
}
```

Failures carry `error: { code, message, details }` instead of `data`.
**`error.code` is contractual** — clients switch on it, so a code is never
reworded once shipped. Validation failures return **422** with a
`{ field, constraint, message }` list; 400 is reserved for malformed
requests.

`summary` is always a second aggregate over the same `WHERE` clause, never
a reduction over the current page — "43 unread" only helps if it describes
the whole inbox.

Exports are the one exception: they stream binary. Errors raised before the
stream opens still return the normal envelope.

---

## Getting started

**Requires** Node.js 20+ and Docker.

```bash
git clone https://github.com/anjeelupreti/sambehen.git
cd sambehen/backend          # every command below runs from here
npm ci

cp .env.example .env          # then set four DISTINCT JWT secrets
docker compose up -d db redis

npm run db:migrate
npm run db:seed
npm run start:dev
```

Swagger: <http://localhost:3001/api/docs> (port from `APP_PORT` in `.env`)
— paste the **raw** token into Authorize, with no `Bearer ` prefix.

Seeded accounts all use `Password123!`:

| Account                                              | Role    |
| ---------------------------------------------------- | ------- |
| `master@sambehen.local`                              | master  |
| `manager1@sambehen.local`, `manager2@sambehen.local` | manager |
| `store11@sambehen.local` … `store22@sambehen.local`  | store   |

The seed deliberately builds **two** managers with two stores each. With a
single manager, a broken scope predicate that returns everything looks
identical to one that returns the right rows.

#### What the seed produces

| Area          | Contents                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Staff         | 1 master, 2 managers, 4 stores                                           |
| Customers     | 24, spread across both chains, with a mix of statuses                    |
| Transactions  | Debits, credits and corrections against seeded games                     |
| VIP criteria  | 3 — two active tiers plus one closed window                              |
| VIP quals     | ~70, **computed from the seeded spend**, not invented                    |
| Spin events   | 3 — two completed, one scheduled; preselected and post-draw both present |
| Spin winners  | 5, drawn only from customers who actually qualified                      |
| Audit entries | ~94 across 6 actors and 13 actions, including refusals                   |

Two details are deliberate. **VIP qualification and spin winners are derived
from the transactions already seeded**, by reading spend back out of the
database — so the VIP list agrees with the transaction list instead of
contradicting it.

And the **audit trail is seeded to be worth reading**: several staff plus a
customer and a system actor, successes alongside a store refused another
chain's customer (`404`) and a manager refused the audit trail itself
(`403`), and one scheduled-job entry with no request behind it — which is
why `statusCode` is nullable. A trail of nothing but `200`s from one account
demonstrates nothing.

### Scripts

| Command                                            | What it does                                 |
| -------------------------------------------------- | -------------------------------------------- |
| `npm run start:dev`                                | Watch mode                                   |
| `npm run build` / `start:prod`                     | Compile / run compiled output                |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle migration workflow                   |
| `npm run db:seed`                                  | Seed the staff hierarchy and sample data     |
| `npm test` / `test:cov`                            | Unit tests                                   |
| `npm run test:e2e`                                 | Cross-tenant suite (needs a seeded database) |
| `npm run docs:openapi`                             | Write `openapi.json` for the frontend        |
| `npm run lint` / `type-check`                      | Quality gates, also enforced pre-commit      |

---

## Testing

```bash
npm test          # 87 unit tests
npm run test:e2e  # 33 cross-tenant tests over real HTTP
```

The e2e suite is the important one. Unit tests prove `ScopeService` is
correct in isolation; the e2e suite proves every endpoint actually composes
it. A scoping bug fails silently — a leaking endpoint returns `200` with
somebody else's rows and nothing looks wrong.

**When adding an endpoint that touches customer-derived data, add a
cross-tenant case for it.**

---

## Layout

```
src/
├── main.ts, app.module.ts, swagger.ts
├── config/            # namespaced config + Joi env validation (fails fast at boot)
├── common/            # response envelope, error codes, guards, filters, decorators
├── database/
│   ├── schema/        # 19 Drizzle tables
│   ├── migrations/    # 9 generated SQL migrations — tracked, incl. meta/
│   └── repositories/  # BaseRepository: pagination, search, whitelisted sorting
├── modules/           # auth · customers · staff · games · transactions · vip
│                      # spins · referrals · messaging · dashboard · emailing · exports
└── shared/
    ├── scope/         # ScopeService — the security boundary
    ├── auth/  audit/  mailer/  cache/  logger/  health/
docs/                  # IMPLEMENTATION_PLAN.md · ARCHITECTURE.md
test/                  # cross-tenant e2e suite
```

Background work needs no broker: `@Cron` handles VIP recompute, spin status
transitions and email dispatch, while `@OnEvent` drives VIP re-evaluation
and referral settlement off transaction entry. The email queue is a
database table claimed with `FOR UPDATE SKIP LOCKED`.

---

## Deployment

### Locally

```bash
docker compose up -d db redis   # dependencies only, app in watch mode
npm run start:dev

docker compose up --build       # or the whole stack in containers
```

`docker-compose.yml` brings up app + Postgres 16 + Redis 7 with health
gates, so the app waits for both rather than crash-looping. `Dockerfile` is
a multi-stage Alpine build running as non-root.

Migrations are **not** applied at boot — a container restart under load
would otherwise race several instances into the same migration. Run
`npm run db:migrate` as a deliberate step before rolling out.

### In production

Anywhere that runs a long-lived container: Fly.io, Railway, Render, ECS, a
VM with Docker. The image needs a Postgres and a Redis, and the env vars in
[.env.example](.env.example) — the app validates them at boot with Joi and
exits immediately if any are missing, so a misconfigured deploy fails
loudly instead of half-working.

`main.ts` calls `enableShutdownHooks()`, and every long-lived handle (pg
pool, Redis) is closed by a lifecycle hook, so SIGTERM actually ends the
process instead of waiting for SIGKILL.

CI ([ci.yml](../.github/workflows/ci.yml)) runs lint → type-check → build →
migrate → unit tests → seed → e2e → OpenAPI generation against real
Postgres and Redis services, all with `working-directory: backend`.

Image publishing and the ECS deploy ([cd.yml](../.github/workflows/cd.yml))
are **off by default**, gated behind the `PUBLISH_IMAGE` and
`DEPLOY_ENABLED` repository variables — otherwise every build would fail on
AWS secrets that a fork or a fresh clone does not have.

### Not Vercel

The frontend deploys to Vercel; this does not, and forcing it there would
quietly break three things:

| Feature                | Why it breaks on serverless                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Socket.IO messaging    | Functions do not hold open connections. Real-time threads need a persistent process.                        |
| `@Cron` jobs           | VIP recompute, spin status flips and email dispatch need a always-on scheduler, not request-triggered code. |
| The pg connection pool | Each cold start opens its own pool. Under load that exhausts Postgres connections rather than reusing them. |

Run the API on a container host and point the frontend's `API_URL` at it.
That is the split the frontend is written for — it calls the API
server-side, so the two never need to share a domain.

---

## Project status

Built in 11 phases, each on its own branch and merged to `main`. History is
Conventional Commits, enforced by commitlint.

Deliberately **not** done:

1. **CI has never been observed running green on GitHub.** The workflow was
   only recently made runnable; every verification so far is from a local
   machine.
2. **Email is untested against a real SMTP provider.** The queue, retries
   and templates work end to end against a local catcher, but not against
   something enforcing SPF/DKIM with its own bounce behaviour.
3. **14 assumptions are implemented as defaults, not confirmed** — see
   [§7 Open Decisions](docs/IMPLEMENTATION_PLAN.md). Most are cheap to
   flip; validation-returns-422, separate bonus/real ledgers, and
   managers-may-own-customers-directly are the disruptive ones once a
   frontend depends on them.

---

## Documentation

| Document                                                   | What it's for                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)               | Decisions and the reasoning behind them — read before changing anything |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase plan, domain model, role matrix, formulas, open decisions         |
| `/api/docs`                                                | Live Swagger, including every allowed enum value                        |
| `npm run docs:openapi`                                     | `openapi.json` for frontend codegen (untracked — always regenerate)     |
