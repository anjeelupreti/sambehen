# Testing checklist — feat/frontend-nextjs-shadcn

This branch is pushed to `origin/feat/frontend-nextjs-shadcn` and not yet merged to
`main`. Use this to validate before that decision.

## Running it

Both servers are already running locally:

- Frontend: **http://localhost:3000**
- Backend: **http://localhost:3003/api/v1** (Swagger at `/api/docs`)

If either isn't responding, restart from a terminal:

```bash
# Postgres + Redis (Docker Desktop must be running first)
cd backend && docker compose up -d db redis

# Backend
cd backend && npm run start:dev

# Frontend, in a separate terminal
cd frontend && npm run dev
```

**Changing the port:** the backend's is `APP_PORT` in `backend/.env` (default
`3003`); the frontend has no default env var and just falls back to `3000`,
pass `-p <port>` to `next dev` to change it. If you change the backend's
port, update `API_URL` and `NEXT_PUBLIC_WS_URL` in `frontend/.env.local` to
match, or the frontend will build fine and then fail to reach the API —
see [README.md § Changing the port](README.md#changing-the-port) for the
full table.

The database already has seed data from earlier verification passes. To reset to a
clean seed instead: `cd backend && npm run db:seed` (idempotent — safe to re-run,
reuses existing accounts rather than duplicating them).

## Credentials

Every seeded account uses the same password: **`Password123!`**

**Staff** (sign in at http://localhost:3000/login, username or email):

| Username | Role | Sees |
|---|---|---|
| `master` | Master | Everything |
| `manager1`, `manager2` | Manager | Their own stores and customers; not staff/audit-logs across other chains |
| `store11`, `store12`, `store21`, `store22` | Store | Their own customers only; no Staff, Broadcast, Audit trail, or Messages-across-manager |

**Customers** (sign in at http://localhost:3000/customer/login):

`customer1` through `customer24` — spread across the stores/managers above, a mix
of active/inactive/suspended so status filters have something to show.

## What to check

### Sign-in and roles
- [ ] Staff sign-in, sign-out, and session survives a page refresh
- [ ] Customer sign-in at `/customer/login` (separate from staff — signing into one must not affect the other in the same browser)
- [ ] As `store12`: sidebar has no Staff, Broadcast, or Audit trail entries — and typing those URLs directly shows "Not found," not an error
- [ ] As `manager1`: Staff and Broadcast are visible; Audit trail is not
- [ ] As `master`: everything is visible

### Customers
- [ ] List loads, filters (status, activity, city, country, date range) narrow results, search works
- [ ] Create a customer — as `master` you must pick an owner; as a manager/store it defaults to you
- [ ] Click into a customer, see their transaction history and trend chart
- [ ] Change status (suspend/reactivate), reset password
- [ ] **Import**: Customers page → Import. Upload a spreadsheet with an Email/Username column (and optionally Full Name/Phone/City/Country), confirm the preview shows valid rows ticked and problem rows called out, untick a row, commit, confirm only the ticked rows were created
- [ ] Export button downloads a real spreadsheet matching the current filters

### Transactions
- [ ] Record a transaction against a customer, see it appear in their history
- [ ] Amount range filter — try dragging the slider as well as typing exact figures
- [ ] Record a correction against an existing transaction

### VIPs
- [ ] As `master`: create/edit a VIP criteria, recompute qualifications
- [ ] Qualified customers list reflects real activity (not hand-entered)

### Spins
- [ ] As `master`: create a spin event (try both preselected and post-draw modes)
- [ ] Record winners on a post-draw event, limited to customers who actually qualify

### Games
- [ ] List, create a game, upload a cover image (PNG/JPG/WEBP/GIF — try uploading something else, like a `.txt` renamed to `.png`, and confirm it's rejected)
- [ ] Click a game row — lands on its detail page with the image, code, category, description

### Referrals
- [ ] As `master`: create a referral program, issue codes to a few customers
- [ ] Open one issued referral link (`http://localhost:3000/r/<slug>`) in an incognito/private window — no sign-in, shows the program's offer and the code
- [ ] Create a new customer and paste that code into the "Referral code" field — confirm the referral shows up as `pending` in the ledger

### Public welcome page & self-registration
- [ ] `http://localhost:3000/` with no session shows the marketing welcome page, not a redirect to `/login`
- [ ] Navbar's Customer/Staff toggle changes where Login/Register point; Register only appears in Customer mode
- [ ] `/customer/register` — create an account, confirm the "awaiting approval" message, then try `/customer/login` with those credentials and confirm it's refused
- [ ] As `master`: `/customers?status=pending` shows the new signup with no owner; it's absent from the default (unfiltered) list
- [ ] Dashboard shows an amber "N self-registered customers are waiting on your approval" banner, linking to the same filtered view
- [ ] Click "Approve", assign a manager or store — confirm the customer becomes `active` and can now sign in at `/customer/login`
- [ ] As `manager1`/a store: confirm pending customers never appear in your customer list (they have no owner yet)

### Messaging
- [ ] Chat bubble (bottom-right) — open a conversation, send a message
- [ ] Open the full `/messages` page and confirm the same conversations appear there, with a live indicator
- [ ] Send a message from one browser tab, confirm it appears in another tab signed in as the same or a supervising staff member **without a refresh** (this is the live-socket path — if it only shows up after 30s or a reload, the socket isn't connecting)

### Broadcast (master/manager only)
- [ ] Compose a campaign, use the audience preview before sending — confirm the count changes when you change filters
- [ ] After sending, open "View recipients" on a campaign and export just that campaign's recipients

### Staff
- [ ] As `master`: create a new staff member, deactivate one
- [ ] As `manager1`: confirm you only see your own stores, not `manager2`'s

### Audit trail (master only)
- [ ] Entries appear for actions you just took elsewhere in this checklist
- [ ] Filter by actor type and date range

### Customer portal
- [ ] Sign in as `customer1`: dashboard shows balance, VIP standing, recent wins, referral code if any
- [ ] `/customer/profile` shows account details, read-only
- [ ] `/customer/messages` — send a message to staff, confirm a staff member sees it live

### Cross-cutting
- [ ] Dark mode toggle, and the accent color picker in the same menu
- [ ] Resize the browser to a phone width — sidebar collapses to a usable mobile nav, tables stay usable rather than clipping
- [ ] Every list's Export button downloads a real, openable spreadsheet

## Known open items (not blockers to testing, but don't be surprised)

- **A 404 on a specific record** (e.g. a customer id that doesn't exist, or belongs
  to another manager's chain) shows the correct "Not found" page but the HTTP
  status code underneath is 200, not 404. Content and access control are both
  correct — a wrong customer id never leaks another chain's data — this only
  matters if you're checking status codes with a tool rather than looking at the
  page. (Role-restricted *pages* like `/staff` for a store were fixed to return a
  real 404 this session; this remaining case is the same bug for record lookups
  specifically, and needs a bigger structural fix to close.)
- Nothing from this branch has been merged into `main` yet.
