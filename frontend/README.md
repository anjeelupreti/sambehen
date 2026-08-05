# Sambehen — Frontend

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-new--york-000000)

Staff-facing web client for the [Sambehen API](../backend). Next.js App
Router, React Server Components, Tailwind v4 and shadcn/ui.

> **Status: the staff app is complete and verified against a running API.**
> Dashboard (with charts), customers, transactions, messages, VIPs, spins,
> games, staff and the audit trail are all built, with filters, sortable
> columns, write actions and live messaging over Socket.IO.
>
> Two things are deliberately unfinished and are listed in
> [§ What's not built](#whats-not-built): **email campaigns**, and the
> **customer portal**, which has a sign-in page but nothing behind it.
>
> Types are **generated** from the API's OpenAPI document — see
> [§ Types are generated](#types-are-generated). Do not hand-write them.

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

| Helper       | Returns                   | Use for                             |
| ------------ | ------------------------- | ----------------------------------- |
| `apiGet`     | `data`                    | A single resource                   |
| `apiList`    | `{ data, meta, summary }` | Lists — keeps pagination and totals |
| `apiMutate`  | `data`                    | POST / PATCH / DELETE               |
| `apiRequest` | The whole envelope        | When you need `correlationId`       |

Failures throw `ApiError` carrying `status`, `code`, `details` and
`correlationId`. **Branch on `code`, never on `message`** — codes are
contractual, messages get reworded.

`summary` is computed by the API over the _whole filtered set_. Never
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

| Variable               | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `API_URL`              | Backend origin. **Server-side only** — never exposed.           |
| `API_PREFIX`           | Route prefix, matches the backend's `API_PREFIX`+`API_VERSION`. |
| `NEXT_PUBLIC_CURRENCY` | Display currency for money formatting.                          |
| `NEXT_PUBLIC_LOCALE`   | Number and date formatting locale.                              |

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

| Setting        | Value                     |
| -------------- | ------------------------- |
| Root Directory | `frontend`                |
| Framework      | Next.js (auto-detected)   |
| Build Command  | `npm run build` (default) |
| Install        | `npm install` (default)   |

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
_not_ belong on Vercel, for reasons documented there.

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

Nothing in the navigation 404s. These two areas have no page, and are
therefore **not advertised** in the sidebar — add the nav entry in the same
commit as the page, never before it.

| Area                | Endpoint                | Notes                                                |
| ------------------- | ----------------------- | ---------------------------------------------------- |
| **Email campaigns** | `/team/email/campaigns` | Audience preview before send                         |
| **Customer portal** | `/me/*`                 | See below — a sign-in page exists, nothing behind it |

### The customer portal is a stub, and currently misleading

`/customer/login` exists and calls the right endpoint
(`/auth/customer/login`), but it then writes the **staff** session cookies
and redirects to the **staff** dashboard. The two realms are signed with
different secrets, so a customer landing there has a token every team route
rejects — and, because both realms share one cookie namespace, signing in as
a customer clobbers any staff session in the same browser.

The API side is complete (`/me/dashboard`, `/me/profile`, `/me/messages`,
`/me/vip-status`, `/me/referral`). What is missing is a portal to land on
and a separate cookie namespace to land with. Until one is built, the link
from the staff sign-in page leads somewhere that does not work.

Also still absent: tests.

### Types are generated

`lib/types.ts` is thin aliases over `lib/api-schema.d.ts`, which is
generated from the API:

```bash
npm run types:api      # regenerates backend/openapi.json, then the .d.ts
```

An earlier hand-written version type-checked cleanly while getting the login
payload, the dashboard shape and two list summaries wrong — every one of
which surfaced as a broken page rather than a compile error. Do not
reintroduce hand-written response types.

### Sessions refresh themselves

The access token lasts about fifteen minutes; the refresh token lasts a
week. `middleware.ts` mints a new pair when the access token has expired, so
a session survives for a week of activity.

This has to happen in middleware: a Server Component cannot set a cookie
during render, so it can only notice an expired token and redirect — which
is precisely what produced an infinite `/dashboard` ⇄ `/login` loop before
the middleware existed. Every exit path there either establishes a working
session or clears it completely; a half-session is what the loop was made
of.

---

## Related

| Document                                                           | What it covers                        |
| ------------------------------------------------------------------ | ------------------------------------- |
| [../backend/README.md](../backend/README.md)                       | The API, its rules, and how to run it |
| [../backend/docs/ARCHITECTURE.md](../backend/docs/ARCHITECTURE.md) | Why the API is shaped the way it is   |
| `/api/docs` on a running backend                                   | Live Swagger, every enum value        |
