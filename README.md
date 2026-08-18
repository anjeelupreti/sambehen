# Sambehen

Data entry management system. A team records customer activity, and the
system derives everything else from it — spending totals, VIP standing,
referral bonuses, spin winners, campaign audiences and dashboards.

Two applications, deployed separately:

| Directory              | What it is                                | Runs on (local dev)      |
| ----------------------- | ------------------------------------------ | ------------------------- |
| [backend/](backend)    | NestJS + Drizzle + PostgreSQL + Redis API | http://localhost:3003    |
| [frontend/](frontend)  | Next.js 15 + shadcn/ui — staff app + customer portal | http://localhost:3000 |

Each has its own README, its own `package.json`, and its own install. There
is no root install and no workspace hoisting — the two toolchains stay
independent.

---

## Running it locally, from a clean checkout

### Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres and Redis — you can point at externally
  hosted instances instead if you set the env vars accordingly)

### 1. Clone

```bash
git clone https://github.com/anjeelupreti/sambehen.git
cd sambehen
```

### 2. Backend

```bash
cd backend
npm ci
cp .env.example .env
```

Open `.env` and set:

- **Four distinct JWT secrets** (`JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `JWT_CUSTOMER_SECRET`, `JWT_CUSTOMER_REFRESH_SECRET`) — generate each with
  `openssl rand -hex 32`. They must all be different: the staff and
  customer realms are deliberately signed with separate secrets, so a
  customer's token is rejected on a staff route at signature verification,
  not by a claim check that a forged token could satisfy.
- `DB_PORT` / `REDIS_PORT` if 5432/6379 are already taken on your machine
  by something else (see [Changing the port](#changing-the-port)
  below) — otherwise leave the defaults.
- SMTP settings, if you want outbound email to actually send. Without
  them, campaigns and notifications queue but never deliver — everything
  else works normally.

Then bring up the database and start the API:

```bash
docker compose up -d db redis
npm run db:migrate
npm run db:seed          # idempotent — safe to re-run
npm run start:dev        # http://localhost:3003, Swagger at /api/docs
```

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env.local   # if not already present
npm run dev                        # http://localhost:3000
```

`.env.local` should have `API_URL=http://127.0.0.1:3003` and
`NEXT_PUBLIC_WS_URL=http://127.0.0.1:3003` pointing at the backend from
step 2 (adjust the port if you changed `APP_PORT` there).

### 4. Sign in

Staff: **http://localhost:3000/login** — `master` / `Password123!` (see
[Users and logins](#users-and-logins) below for the full roster).

Customer portal: **http://localhost:3000/customer/login** —
`customer1` / `Password123!`.

### Changing the port

Nothing in this app is hard-coded to a specific port — every one of them
is read from an env var at startup:

| What | Where it's set | Default |
| --- | --- | --- |
| Backend (NestJS) | `APP_PORT` in `backend/.env` | `3003` |
| Postgres | `DB_PORT` in `backend/.env` | `5432` |
| Redis | `REDIS_PORT` in `backend/.env` | `6379` |
| Frontend (Next.js) | no env var by default — pass `-p <port>` to `next dev`/`next start`, or add it permanently to the `dev`/`start` scripts in `frontend/package.json` | `3000` |

**If you change the backend's `APP_PORT`, update `frontend/.env.local` to
match** — `API_URL` and `NEXT_PUBLIC_WS_URL` both point at the backend by
its full origin (e.g. `http://127.0.0.1:3003`), and the frontend has no
way to discover the backend's port other than being told. Forgetting this
step is the most common cause of "the frontend loads but nothing signs
in" — the browser or the server-side fetch is quietly trying to reach a
backend that isn't listening where it thinks it is.

This comes up often on a machine running several local projects at once —
3000, 5432 and 6379 are common defaults, so collisions happen. Change
whichever `*_PORT` is taken, update the frontend to match if it was the
backend's, and restart both.

---

## Users and logins

Every seeded account shares one password: **`Password123!`**. Sign in with
either the username or the email.

**Staff** (http://localhost:3000/login) — three roles, forming a chain:

| Username | Role | Sees |
| --- | --- | --- |
| `master` | Master | Everything, every chain. Only role that can see the audit trail, define VIP criteria and referral programs, create staff. |
| `manager1`, `manager2` | Manager | Their own stores and the stores' customers. Can use Staff and Broadcast; cannot see the audit trail or another manager's chain. |
| `store11`, `store12`, `store21`, `store22` | Store | Only their own customers. No Staff, Broadcast, Audit trail, or Messages outside their own customers. |

A role-forbidden page (a store opening `/staff`, for example) returns a
genuine 404, not a 403 — the app never confirms that a page or record
exists outside what the signed-in role can see.

**Customers** (http://localhost:3000/customer/login) — `customer1` through
`customer24`, spread across the stores/managers above with a mix of
active/inactive/suspended status.

Reset to a clean seed at any point with `cd backend && npm run db:seed` —
it reuses existing accounts rather than duplicating them, so it's safe to
run against a database that already has data.

---

## What's built

**Staff app** — dashboard with charts and trends; customers (list, filters,
create, edit, status changes, bulk import from a spreadsheet with a
reviewable preview, export); transactions (record, corrections, export);
VIPs (master-defined criteria, computed qualifications, export); spin
events and winners; games, including cover image upload; staff management
with the role chain above; the audit trail; referral programs and the
codes/ledger they produce; broadcast email campaigns with an audience
preview; live messaging over Socket.IO (a floating chat bubble and a full
inbox page) with multi-file attachments. Every list that can be exported
has an Export button producing a real spreadsheet scoped to the filters on
screen.

**Customer portal** — sign-in, a dashboard (balance, VIP standing, recent
wins, referral link with a copy button), a read-only profile page, and the
same live messaging thread with attachments.

**Public, unauthenticated pages** — a referral landing page
(`/r/{code}`) that states the offer without requiring a signup (customer
accounts are created by staff, never self-served — the page hands the
visitor a code to give the team), and an email unsubscribe landing page.

Full feature-by-feature checklist: [TESTING.md](TESTING.md).

---

## The rules that matter

Both applications depend on these. Breaking one is a data bug, not a style
disagreement.

**Scoping is the security boundary.** A manager cannot see another
manager's chain; a store sees only their own customers. Enforced in SQL by
`ScopeService`, composed into every list, mutation, metric and export.

**A row you cannot see returns 404, never 403.** A 403 would confirm the
record exists. The frontend says "not found" to match, including for
role-restricted pages.

**Money is `numeric(18,2)`, serialised as strings.** Never a float, never
parsed into a JS number in transit. Aggregation happens in SQL. The one
sanctioned exception is turning a money string into a chart coordinate
(`toPlotValue` in `frontend/lib/money.ts`) — never used for a total shown
on screen.

**A credit with a parent is a correction, not a withdrawal.** Conflating
them misreports what a customer actually took out.

Full reasoning in
[backend/docs/ARCHITECTURE.md](backend/docs/ARCHITECTURE.md).

---

## Known limitations

- **Outbound email is not configured for send.** SMTP needs valid
  credentials in `backend/.env`; without them, campaigns queue but never
  deliver.
- **Free-text search has no supporting index.** Every search box
  (customers, transactions, staff, games) matches with `ILIKE '%term%'`,
  which cannot use a normal index. Invisible at low data volumes; will
  slow down as real data accumulates. The fix (trigram indexes) is
  understood but not yet applied.
- **No automated frontend tests.** The backend has a unit test suite
  (`cd backend && npm test`); the frontend is verified by hand against a
  running API, not by an automated suite.

---

## Repo tooling

Git hooks live at the root and cover both applications:

- **pre-commit** — each workspace runs `lint-staged` over its own staged
  files with its own toolchain. A workspace you have not installed is
  skipped.
- **commit-msg** — Conventional Commits, enforced by commitlint. Its config
  and packages live in `backend/`, but the convention applies to every
  commit in the repo.

Hooks install when you run `npm ci` in `backend/`.

`.editorconfig` and `.prettierrc` sit at the root so both applications
share one formatting baseline.
