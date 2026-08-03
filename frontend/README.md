# Sambehen — Frontend

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-new--york-000000)

Staff-facing web client for the [Sambehen API](../backend). Next.js App
Router, React Server Components, Tailwind v4 and shadcn/ui.

> **Status: scaffold.** Auth, the app shell, and three read screens
> (dashboard, customers, transactions) are implemented end to end against
> the real API contract. The remaining screens listed in
> [§ What's not built](#whats-not-built) are navigation entries only.
>
> **This has never been installed or built** — it was written while the
> machine had no free disk space for `npm install`. Treat the first
> `npm install && npm run build` as the real review. See
> [§ First run](#first-run).

---

## How it talks to the API

Three decisions shape everything here. They follow from how the backend
works, so changing them means fighting it.

**1. The browser never calls the API.** Server Components fetch on the
server and send rendered output. There is no CORS surface, no API base URL
in the bundle, and no token in client JavaScript.

**2. Tokens live in httpOnly cookies.** Login exchanges credentials through
a Server Action; the response is written to cookies the browser cannot
read. Injected script cannot exfiltrate a session.

**3. A 404 means "not found", never "no access".** The API returns 404 for
a row outside your scope, deliberately indistinguishable from one that does
not exist — a 403 would confirm it exists. **The UI must never say
"forbidden" for a 404**, or it undoes that.

```
Browser ──▶ Next.js server ──▶ API
           (holds the cookie)   (scopes every row to the actor)
```

### The envelope

Every API response is wrapped. [lib/api.ts](lib/api.ts) unwraps it so pages
deal in domain data:

| Helper       | Returns                     | Use for                             |
| ------------ | --------------------------- | ----------------------------------- |
| `apiGet`     | `data`                      | A single resource                   |
| `apiList`    | `{ data, meta, summary }`   | Lists — keeps pagination and totals |
| `apiMutate`  | `data`                      | POST / PATCH / DELETE               |
| `apiRequest` | The whole envelope          | When you need `correlationId`       |

Failures throw `ApiError` carrying `status`, `code`, `details` and
`correlationId`. **Branch on `code`, never on `message`** — codes are
contractual, messages get reworded.

`summary` is computed by the API over the *whole filtered set*. Never
recompute it by reducing over `data`: that only sees the current page.

### Money

Money is `numeric(18,2)` serialised as **strings**, because a float cannot
hold every 2dp decimal and the error compounds once you add. Nothing here
parses money into a number except [lib/money.ts](lib/money.ts), at the
final formatting step for one value at a time.

Use `<Money value={row.totalSpent} />` — right-aligned, tabular figures, so
a misplaced decimal is visible without reading the numbers.

### Debit, credit, corrections

- **Debit** = money in. **Credit** = money out.
- A credit **with a parent** is a **correction** of an earlier entry, not a
  withdrawal.

The transactions table badges corrections separately for exactly this
reason. Folding them into withdrawals is the easiest way to misreport what
a customer actually took out.

---

## First run

**Requires** Node.js 20+ and the [backend](../backend) running.

```bash
cd frontend
npm install

cp .env.example .env.local     # API_URL must point at the backend
npm run dev                    # http://localhost:3001
```

The backend defaults to port 3000, so run this on another port:

```bash
npm run dev -- -p 3001
```

Sign in with a seeded account (`npm run db:seed` in the backend) —
`master@sambehen.local` / `Password123!`.

### Verify before trusting it

This scaffold has never been installed. Run these first and expect to fix
things:

```bash
npm install
npm run type-check    # hand-written types vs the real OpenAPI document
npm run lint
npm run build
```

The likeliest breakages are pinned dependency versions drifting from what
resolves today, and the response shapes in [lib/types.ts](lib/types.ts) —
those were typed by hand from the backend DTOs, not generated. Regenerate
the source of truth with `npm run docs:openapi` in the backend and
reconcile any drift.

### Environment

| Variable               | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `API_URL`              | Backend origin. **Server-side only** — never exposed.        |
| `API_PREFIX`           | Route prefix, matches the backend's `API_PREFIX`+`API_VERSION`. |
| `NEXT_PUBLIC_CURRENCY` | Display currency for money formatting.                       |
| `NEXT_PUBLIC_LOCALE`   | Number and date formatting locale.                           |

Anything prefixed `NEXT_PUBLIC_` is inlined into the browser bundle at
build time. **Never put a secret behind that prefix.** `API_URL` is
deliberately not public.

---

## Layout

```
app/
├── layout.tsx, globals.css        # shadcn tokens, money direction colours
├── page.tsx                       # redirects by session state
├── login/                         # Server Action auth, httpOnly cookies
└── (app)/                         # signed-in shell — session required
    ├── layout.tsx                 # sidebar, role badge, sign out
    ├── error.tsx                  # says "not found", never "forbidden"
    ├── dashboard/                 # scoped metrics, top games
    ├── customers/                 # scoped list, search, pagination
    └── transactions/              # debit / credit / corrections
components/
├── ui/                            # shadcn primitives
├── money.tsx                      # the only correct way to render money
├── stat-card.tsx  app-sidebar.tsx  pagination-controls.tsx  search-field.tsx
lib/
├── api.ts                         # envelope unwrapping, ApiError
├── session.ts                     # httpOnly cookie session, server-only
├── money.ts                       # formatting; never arithmetic
└── types.ts                       # hand-typed from the OpenAPI document
```

### Adding a shadcn component

```bash
npx shadcn@latest add dialog
```

[components.json](components.json) is configured (new-york, slate, RSC), so
components land in `components/ui/` with the right import aliases.

### Adding a page

1. Create `app/(app)/<name>/page.tsx` as an async Server Component.
2. Fetch with `apiList` / `apiGet` — pass filters straight through as
   `query`. The API validates them and returns 422; do not add a second
   whitelist.
3. Render `summary` from the response rather than computing totals.
4. Add the route to `NAV` in [components/app-sidebar.tsx](components/app-sidebar.tsx),
   with `roles` if it is not for everyone.

Hiding a nav item is presentation, not access control — the API refuses the
request regardless of what the sidebar shows.

---

## Deployment

### Vercel

The natural home for this half. Point Vercel at the repo and set the **root
directory to `frontend`** — without that it builds the backend and fails.

| Setting        | Value                            |
| -------------- | -------------------------------- |
| Root Directory | `frontend`                       |
| Framework      | Next.js (auto-detected)          |
| Build Command  | `npm run build` (default)        |
| Install        | `npm install` (default)          |

Environment variables, set for Production and Preview:

```
API_URL=https://your-api-host.example.com
API_PREFIX=/api/v1
NEXT_PUBLIC_CURRENCY=USD
NEXT_PUBLIC_LOCALE=en-US
```

Or from the CLI:

```bash
npm i -g vercel
cd frontend
vercel link
vercel env add API_URL production
vercel --prod
```

**The API must be reachable from Vercel's servers**, not just your laptop —
`localhost` will not resolve there. Deploy the backend somewhere public
first ([backend deployment](../backend/README.md#deployment)); it does
*not* belong on Vercel, for reasons documented there.

Cookies are `secure` when `NODE_ENV=production`, which Vercel sets, so the
session requires HTTPS in production. That is intended.

### Self-hosted

```bash
npm run build
npm run start        # defaults to port 3000
```

Or containerise it — `output: 'standalone'` in
[next.config.ts](next.config.ts) is worth enabling first, so the image
carries only the traced dependencies.

---

## What's not built

The sidebar lists these; the routes do not exist yet. Each is a Server
Component reading an endpoint the API already exposes:

| Screen        | Endpoint                    | Notes                                    |
| ------------- | --------------------------- | ---------------------------------------- |
| Messages      | `/team/conversations`       | Socket.IO for live updates               |
| VIPs          | `/team/vips`                | Plus criteria management for master       |
| Spin winners  | `/team/spin-winners`        | Scoped register, not the masked feed      |
| Games         | `/team/games`               | Read for all, write for master            |
| Staff         | `/team/staff`               | Master and manager only                   |
| Email         | `/team/email/campaigns`     | Audience preview before send              |
| Exports       | `/team/exports`             | 14 lists; streams binary, needs a download handler |
| Audit trail   | `/team/audit-logs`          | Master only                               |
| Customer detail | `/team/customers/:id`     | Linked from the list but not yet written  |

Also absent: any write path (creating customers, recording transactions),
token refresh on expiry (the session currently just ends), and tests.

---

## Related

| Document                                             | What it covers                         |
| ---------------------------------------------------- | -------------------------------------- |
| [../backend/README.md](../backend/README.md)         | The API, its rules, and how to run it  |
| [../backend/docs/ARCHITECTURE.md](../backend/docs/ARCHITECTURE.md) | Why the API is shaped the way it is     |
| `/api/docs` on a running backend                     | Live Swagger, every enum value          |
