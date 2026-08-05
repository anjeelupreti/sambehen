# Sambehen

Data entry management system. A team records customer activity, and the
system derives everything else from it — spending totals, VIP standing,
referral bonuses, spin winners, campaign audiences and dashboards.

Two applications, deployed separately:

| Directory                | What it is                                        | Deploys to                    |
| ------------------------ | ------------------------------------------------- | ----------------------------- |
| [backend/](backend)      | NestJS + Drizzle + PostgreSQL + Redis API         | A container host — **not Vercel** |
| [frontend/](frontend)    | Next.js 15 + shadcn/ui staff client               | Vercel                        |

Each has its own README, its own `package.json`, and its own install. There
is no root install and no workspace hoisting — the two toolchains stay
independent.

---

## Start here

```bash
git clone https://github.com/anjeelupreti/sambehen.git
cd sambehen
```

**Backend** — see [backend/README.md](backend/README.md):

```bash
cd backend
npm ci
cp .env.example .env          # set four DISTINCT JWT secrets
docker compose up -d db redis
npm run db:migrate && npm run db:seed
npm run start:dev             # http://localhost:3000, Swagger at /api/docs
```

**Frontend** — see [frontend/README.md](frontend/README.md):

```bash
cd frontend
npm install
cp .env.example .env.local    # API_URL=http://localhost:3000
npm run dev -- -p 3001        # http://localhost:3001
```

Sign in with `master@sambehen.local` / `Password123!` from the seed.

---

## The rules that matter

Both applications depend on these. Breaking one is a data bug, not a style
disagreement.

**Scoping is the security boundary.** A manager cannot see another
manager's chain; a runner sees only their own customers. Enforced in SQL by
`ScopeService`, composed into every list, mutation, metric and export.

**A row you cannot see returns 404, never 403.** A 403 would confirm the
record exists. The frontend must say "not found" to match.

**Money is `numeric(18,2)`, serialised as strings.** Never a float, never
parsed into a JS number in transit. Aggregation happens in SQL.

**A credit with a parent is a correction, not a withdrawal.** Conflating
them misreports what a customer actually took out.

Full reasoning in
[backend/docs/ARCHITECTURE.md](backend/docs/ARCHITECTURE.md).

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

---

## Status

**Backend** — complete. All 11 build phases merged. 75 unit tests and 33
cross-tenant e2e tests, 69 API paths, 19 tables. The e2e suite is the one
that matters: a scoping bug fails silently, returning `200` with somebody
else's rows.

**Frontend** — the staff app is complete and verified against a running
API: dashboard with charts, customers, transactions, messages (live over
Socket.IO), VIPs, spins, games, staff and the audit trail, with filters,
sortable columns and write actions throughout. Types are generated from the
API's OpenAPI document rather than hand-written.

Two areas remain: **email campaigns**, and the **customer portal** — which
has a sign-in page that currently writes staff cookies and lands on the
staff dashboard, so it does not work. Both are described in
[frontend/README.md](frontend/README.md#whats-not-built).
