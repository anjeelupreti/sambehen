# Deploying Sambehen

This project is two separate deployables that happen to live in one repo:

| | What it is | Where it can live |
|---|---|---|
| `frontend/` | Next.js 15 App Router app | **Vercel** — this is what Vercel is built for |
| `backend/` | NestJS API: REST + a Socket.IO gateway, a Postgres connection pool, and cron-driven background jobs (email dispatcher, VIP recompute) | **Not Vercel.** Needs a host that keeps one process running |

## Why the backend can't go on Vercel

Vercel runs your server code as serverless functions: each request spins up an isolated invocation and tears it down afterward. Three things in this backend need the opposite of that:

1. **The messaging WebSocket gateway** (`messaging.gateway.ts`, `staff-messaging` real-time delivery) needs a socket that stays open between messages. A serverless function that recycles per-request can't hold a persistent connection.
2. **Cron jobs** (the email campaign dispatcher tick, the VIP qualification drift job) need a process that's still alive a minute from now to fire on schedule. A function that only exists while handling a request has nothing to schedule against.
3. **The DB connection pool** (`DB_POOL_MIN`/`DB_POOL_MAX` in `backend/.env`) is built to be reused across requests on one long-lived process. Serverless cold-starts would open and tear down connections constantly instead.

So: **frontend on Vercel, backend on a container/VPS host that runs `backend/Dockerfile` as a persistent process.** The backend already ships a production-ready multi-stage Dockerfile — you're not writing new deployment infrastructure, just picking a host that will run it.

Reasonable hosts for the backend: Railway, Render, Fly.io, or any VPS with Docker. Pick whichever you already have an account with — the steps below don't depend on which one, since they all just build and run the existing Dockerfile.

---

## Order of operations

Deploy the backend **first**. The frontend needs the backend's live URL to build against (`API_URL`), and the backend needs the frontend's live URL for CORS and for links it generates (referral links, unsubscribe links). You'll set both once each is up, so expect to redeploy the backend once more after the frontend has a URL.

---

## Part 1 — Backend: database, Redis, and the API

### 1.1 Provision Postgres and Redis

The backend needs a reachable Postgres 16+ instance and a Redis instance (cache, rate-limiting, socket presence). Any managed provider works — Neon, Supabase, Railway's built-in Postgres, or your host's own managed offering. Note the connection details; you'll need host, port, username, password, database name, and whether SSL is required (`DB_SSL=true` for almost every managed provider).

### 1.2 Deploy `backend/Dockerfile`

On your chosen host, point it at this repo with `backend/` as the build context (most platforms let you set a subdirectory as the root, or a `Dockerfile path`). The Dockerfile:

- builds with `npm run build` in a `node:20-alpine` stage,
- installs only production dependencies in a second stage,
- copies `dist/`, the Drizzle config, and the migrations folder,
- runs as the non-root `node` user,
- listens on the port from `APP_PORT` (the container `EXPOSE`s 3000 by convention — set `APP_PORT` to whatever your host expects, most auto-inject a `PORT` your host's load balancer targets, so check your platform's convention and set `APP_PORT` to match).

### 1.3 Set backend environment variables

Copy every key from `backend/.env.example` into your host's environment variable settings, with production values:

```
NODE_ENV=production
APP_PORT=<whatever your host expects — see 1.2>
APP_HOST=0.0.0.0
API_PREFIX=api
API_VERSION=1

# Set once you know your Vercel URL — see Part 3. Comma-separate if you
# add a custom domain later.
APP_CORS_ORIGIN=https://your-app.vercel.app
APP_PUBLIC_URL=https://your-app.vercel.app

DB_HOST=<from 1.1>
DB_PORT=<from 1.1>
DB_USERNAME=<from 1.1>
DB_PASSWORD=<from 1.1>
DB_NAME=<from 1.1>
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10

REDIS_HOST=<from 1.1>
REDIS_PORT=<from 1.1>
REDIS_PASSWORD=<from 1.1>
REDIS_DB=0
REDIS_TTL=300

# Four DISTINCT secrets, each 32+ chars. Generate each separately with:
#   openssl rand -hex 32
# Reusing one secret across realms, or reusing a dev secret in production,
# defeats the point of having separate secrets at all.
JWT_SECRET=<generate>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<generate>
JWT_REFRESH_EXPIRES_IN=7d
JWT_CUSTOMER_SECRET=<generate>
JWT_CUSTOMER_EXPIRES_IN=30m
JWT_CUSTOMER_REFRESH_SECRET=<generate>
JWT_CUSTOMER_REFRESH_EXPIRES_IN=30d

THROTTLE_TTL=60000
THROTTLE_LIMIT=100

SMTP_HOST=<your SMTP provider>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your SMTP user>
SMTP_PASSWORD=<your SMTP app password>
MAIL_FROM=no-reply@yourdomain.com
MAIL_FROM_NAME=Sambehen
EMAIL_BATCH_SIZE=50

ACTIVE_CUSTOMER_WINDOW_DAYS=30
HIGH_SPENDER_THRESHOLD=250.00
REFERRAL_LINK_BASE_URL=https://your-app.vercel.app/r

EXPORT_SYNC_ROW_LIMIT=50000
EXPORT_RETENTION_HOURS=48
EXPORT_STORAGE_PATH=/app/storage/exports
EXPORT_TIMEZONE=UTC

LOG_LEVEL=info

# Off in production — it exposes every route, error code, and filter shape.
SWAGGER_ENABLED=false
```

**One thing to get right: `EXPORT_STORAGE_PATH`.** Generated export files land on local disk. If your host replaces the container on every deploy (most do), that directory is wiped each time — fine for exports, since they're meant to be short-lived (`EXPORT_RETENTION_HOURS`), but only if the disk survives *between* requests within a deploy. Mount a persistent volume at that path if your host supports one (the repo's own `docker-compose.yml` does this for local Docker via the `exports` volume); otherwise exports still work, they just won't outlive a redeploy — acceptable for most cases, but know that's the tradeoff.

### 1.4 Run migrations

Before the app serves traffic, apply the schema:

```bash
cd backend
npm run db:migrate
```

Run this with the production `DB_*` env vars in scope — either from your host's shell/console, or as a one-off pre-deploy command if your platform supports that (Railway and Render both let you configure a pre-deploy/release command; use `npm run db:migrate` there so it runs automatically on every deploy rather than something you have to remember).

### 1.5 Verify the backend is live

```bash
curl https://your-backend-host.example.com/api/v1/health
```

Expect `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}...}`. If `database` or `redis` show `down`, double-check the connection env vars and that your DB/Redis provider allows connections from your backend host's IP (some managed providers require an allowlist).

Note your backend's URL — you need it for the frontend in Part 2.

---

## Part 2 — Frontend: deploying to Vercel

### 2.1 Push the repo to GitHub (or GitLab/Bitbucket)

Vercel deploys from a git repo. If this repo isn't hosted remotely yet, push it — Vercel's import flow needs to see it.

### 2.2 Import the project into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in.
2. Click **Import Project**, select your git provider, and pick this repository.
3. Vercel will show a configuration screen before the first deploy — this is where the monorepo setup matters:
   - **Root Directory**: click **Edit** next to it and set it to `frontend`. This is the single most important setting — without it, Vercel will try to build the repo root, find no `next.config.ts`, and fail (or worse, build the backend by mistake).
   - **Framework Preset**: Vercel should auto-detect **Next.js** once the root directory is set to `frontend`. If it doesn't, select it manually.
   - **Build Command**: leave as the detected default (`next build` / `npm run build`) — matches `frontend/package.json`.
   - **Output Directory**: leave as detected (`.next`) — don't override this.
   - **Install Command**: leave as detected (`npm install`).

### 2.3 Set frontend environment variables

Still on the import screen (or later under **Project Settings → Environment Variables**), add:

```
API_URL=https://your-backend-host.example.com
API_PREFIX=/api/v1
NEXT_PUBLIC_CURRENCY=USD
NEXT_PUBLIC_LOCALE=en-US
NEXT_PUBLIC_WS_URL=https://your-backend-host.example.com
```

A few things worth knowing about these:

- **`API_URL` is the bare origin — no `/api` suffix, no trailing slash.** `frontend/lib/api.ts` builds every request as `new URL(API_PREFIX + path, API_URL)`, and `API_PREFIX` already starts with `/`, so it fully replaces whatever path (if any) you put on `API_URL`. Keep it as just the scheme + host, exactly like the local dev value (`http://127.0.0.1:3003`), so there's nothing to silently ignore.
- **`API_URL` has no `NEXT_PUBLIC_` prefix, deliberately** — it's only read server-side (Server Components and Server Actions call the API directly using the session cookie; the browser never talks to it). Don't add the prefix "to be safe" — doing so would inline your backend's internal URL into the client bundle for no reason.
- **`NEXT_PUBLIC_WS_URL` is the one exception** — the messaging feature opens its WebSocket from the browser, so this one genuinely needs to reach client code. It's a URL, not a secret, so that's fine.
- Set these for the **Production** environment at minimum. If you also want Vercel's preview deployments (from PRs) to work end-to-end, add them for **Preview** too — pointing at either the same backend or a staging one, your call.

### 2.4 Deploy

Click **Deploy**. Vercel builds `frontend/` with the env vars above and gives you a URL like `https://your-app.vercel.app`.

The build runs `next build` with **type errors and ESLint errors both set to fail the build** (`frontend/next.config.ts` has `ignoreBuildErrors: false` and `ignoreDuringBuilds: false` on purpose — the frontend's types are generated from the backend's OpenAPI schema, so a real mismatch between them should stop a deploy, not ship silently). If the build fails here, it's telling you something real — check the build log rather than working around it.

### 2.5 Point the backend back at the frontend

Now that you have a real Vercel URL, go back to your backend host's environment variables (Part 1.3) and update:

```
APP_CORS_ORIGIN=https://your-app.vercel.app
APP_PUBLIC_URL=https://your-app.vercel.app
REFERRAL_LINK_BASE_URL=https://your-app.vercel.app/r
```

Redeploy the backend so these take effect. Skipping this step is the most common cause of "it works locally but the deployed frontend can't log in" — the browser's WebSocket connection and any CORS-checked request will be silently rejected by the backend until its `APP_CORS_ORIGIN` matches where the frontend is actually served from.

### 2.6 Custom domain (optional)

Under **Project Settings → Domains** in Vercel, add your domain and follow its DNS instructions (usually a CNAME to `cname.vercel-dns.com`, or an A record if it's an apex domain). Once it's live, repeat step 2.5 with the custom domain instead of the `.vercel.app` one — `APP_CORS_ORIGIN`, `APP_PUBLIC_URL`, and `REFERRAL_LINK_BASE_URL` all need to match wherever the frontend actually ends up.

---

## Part 3 — Verify the whole thing end to end

1. **Backend health**: `curl https://your-backend-host.example.com/api/v1/health` → `database` and `redis` both `up`.
2. **Frontend loads**: visit your Vercel URL — the public welcome page should render (no session yet, so no redirect).
3. **Staff login**: `/login` with a seeded account. If this hangs or 500s, it's almost always the frontend's `API_URL` pointing at the wrong place, or CORS rejecting the request — check the backend's logs for a CORS rejection line.
4. **Customer registration + approval**: register at `/customer/register`, approve it as `master`, confirm the newly-approved account can sign in at `/customer/login` — this exercises the full write path (DB) and confirms migrations actually ran.
5. **Real-time messaging**: open `/messages`, send a message from two browser tabs signed in as different accounts, confirm delivery **without a page refresh**. This is the one thing that only works if the backend is genuinely running as a persistent process with the WebSocket gateway reachable — if it only shows up after a refresh, `NEXT_PUBLIC_WS_URL` or the backend's CORS/WS config is wrong.
6. **Email**: trigger anything that sends mail (a broadcast campaign, if you have SMTP configured) and confirm it actually delivers, not just queues.

---

## Troubleshooting

**Build fails on Vercel with a type error in `lib/api-schema.d.ts` or similar.** That file is generated from the backend's OpenAPI document (`npm run types:api`), not hand-written. If it's out of sync with what the backend actually returns, regenerate it locally against your target backend and commit the result before deploying — don't hand-edit it.

**Login works, but every subsequent page redirects back to `/login`.** Usually a cookie domain/secure mismatch — the session cookies (`sambehen_access`, etc.) are set `httpOnly` and `secure` in production (see `frontend/lib/session.ts`), which requires the frontend to actually be served over HTTPS. Vercel does this by default, so this usually means `API_URL` is pointing at an HTTP (not HTTPS) backend, or the backend and frontend are on mismatched domains in a way that's breaking the cookie.

**WebSocket won't connect (messaging never goes live).** Confirm your backend host actually keeps WebSocket connections open — some serverless-style hosts silently degrade to short-lived connections even when they claim container support. If you're behind a reverse proxy or load balancer in front of the backend, confirm it's configured to upgrade and hold WebSocket connections, not just proxy plain HTTP.

**Exports come back empty or 404 after a redeploy.** See the `EXPORT_STORAGE_PATH` note in 1.3 — if your backend host doesn't persist a volume across deploys, in-flight exports from before the redeploy are gone. This doesn't affect new exports, only ones generated right before a deploy.
