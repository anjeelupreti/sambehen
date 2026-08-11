# Sambehen — User Guide

How to actually use the system: every role, every feature, step by step.
For getting the system *running* on a machine, see [README.md](README.md).
For a QA checklist, see [TESTING.md](TESTING.md). This document is for
someone sitting in front of the app, not a terminal.

## Contents

1. [Who uses this system](#1-who-uses-this-system)
2. [Signing in](#2-signing-in)
3. [Finding your way around](#3-finding-your-way-around)
4. [Your own profile, password, and appearance](#4-your-own-profile-password-and-appearance)
5. [Dashboard](#5-dashboard)
6. [Customers](#6-customers)
7. [Transactions](#7-transactions)
8. [VIPs](#8-vips)
9. [Spin events and winners](#9-spin-events-and-winners)
10. [Games](#10-games)
11. [Staff](#11-staff)
12. [Referrals — how it actually works](#12-referrals--how-it-actually-works)
13. [Broadcast (email campaigns)](#13-broadcast-email-campaigns)
14. [Messaging](#14-messaging)
15. [Audit trail](#15-audit-trail)
16. [Exporting a list](#16-exporting-a-list)
17. [The customer portal](#17-the-customer-portal)
18. [Appendix: who can do what](#18-appendix-who-can-do-what)

---

## 1. Who uses this system

Four kinds of signed-in user, two separate sign-in pages:

**Staff**, at `/login`, in a three-level chain:

- **Master** — sits above the chain, not in it. Sees every customer, every
  manager's team, the audit trail. The only role that defines VIP criteria,
  referral programs, and creates other staff.
- **Manager** — sees their own runners and every customer those runners
  (or the manager directly) own. Cannot see another manager's team at all —
  not a restricted view of it, no trace of it exists for them.
- **Runner** — sees only the customers assigned directly to them.

**Customer**, at `/customer/login` — signs in to see their own balance,
activity and referral link, and to message the team. A customer cannot
edit anything about their own record, including their password — every
change to a customer account is made by the staff above them.

If you try to open a page your role doesn't allow, you get a plain **"Not
found"** — never an "access denied." That's deliberate: the system never
confirms that a page or record exists outside what you're allowed to see.

---

## 2. Signing in

### Staff

1. Go to `/login`.
2. Enter your **username or email**, and your password.
3. Click **Sign in**.
4. You land on the **Dashboard**.

Your session renews itself quietly in the background for up to a week of
activity — you won't be asked to sign in again mid-session.

### Customer

1. Go to `/customer/login` (there's also a link to it from the bottom of
   the staff sign-in page).
2. Enter your username or email and password.
3. Click **Sign in**.
4. You land on your account **Overview**.

Staff and customer sessions are entirely separate — signing into one in a
browser never signs you out of, or interferes with, the other.

### Signing out

Staff: open the **username menu** at the top right of any page → **Sign
out**.
Customer: use the sign-out icon in the portal header.

---

## 3. Finding your way around

**The sidebar** (left side, staff app only) lists every area you have
access to. An item you can't use simply isn't shown — there's no greyed-out
tease.

**The top-right corner** of every staff page has, in order: a **paperclip/
palette icon** for appearance settings, and your **username** — click it
for your own profile, password, and sign-out.

**The chat bubble**, bottom-right of every staff and customer page, is
always there regardless of what page you're on — see
[§14 Messaging](#14-messaging).

**Filters and search** sit directly above every list, as a row of controls
(a search box, dropdowns, date ranges). Whatever you set is reflected in
the URL, so a filtered view can be bookmarked or shared.

**Pagination** is at the bottom of every list. **Sortable columns** show a
small arrow when clicked; click again to reverse the order.

**Export** — most lists have an **Export** button near the top. It
downloads a spreadsheet of exactly what's on screen, respecting your
current filters, not the whole table.

---

## 4. Your own profile, password, and appearance

### Edit your name and phone number (staff)

1. Click your **username**, top right.
2. Select **My Profile**.
3. Edit **First name**, **Last name**, and/or **Phone**.
4. Click **Save changes**.

Your email and username aren't editable here — ask a master or your
manager to change those.

### Change your own password (staff)

1. Open **My Profile** the same way.
2. Scroll to **Change Password**.
3. If you're not a master, enter your **current password** first.
4. Enter a **new password** (8 characters minimum).
5. Click **Update**.

Changing your password signs you out everywhere else it's currently
active, including other tabs or devices.

### Appearance: light/dark mode and accent color

1. Click the **palette icon** at the top right (next to your username).
2. Under **Mode**, choose **Light**, **Dark**, or **System**.
3. Under **Accent Color**, click a swatch to change the color used for
   buttons, links and highlights throughout the app.

This is saved to your browser and applies immediately, no save button.

---

## 5. Dashboard

The landing page after sign-in. Everything on it is scoped to what you can
see — a runner's dashboard only reflects their own customers.

- **Top stat tiles**: customer counts, net balance (all-time and this
  month, with a trend indicator), debit/credit totals.
- **Money in and out over time**: a chart with adjustable granularity
  (day/week/month) and a lookback window — use the controls above the
  chart, then read the same numbers as a table underneath.
- **Top games by debit** and **by credit**: which games your customers are
  most active on.

Nothing here is clickable through to an action — it's a read-only summary.
Go to the relevant list (Customers, Transactions, etc.) to act on anything.

---

## 6. Customers

*Who can: everyone sees their own scope; only a manager/master can assign
ownership.*

### Find a customer

1. Go to **Customers** in the sidebar.
2. Use the **search box** for username, name or email, or the **Status**,
   **Activity**, **City**, **Country** and **date range** filters above the
   table.
3. Click a **column header** (Customer, Status, Net, Last activity) to
   sort by it.

### View a customer's full record

1. From the Customers list, click anywhere on a **row** (or the username
   itself).
2. You'll see their balance, transaction history, and a trend chart of
   their activity, plus buttons for the actions below.
3. Click **All customers** at the top to go back.

### Create a customer

1. On the Customers page, click **New customer**.
2. Fill in **Username**, **Email**, and a **Password** (you set this —
   customers can't change it themselves).
3. If you're a **master**, you must choose an **owner** (a manager or
   runner) — a master sits above the chain and can't own a customer
   directly. If you're a manager or runner, this is optional and defaults
   to you.
4. Optionally fill in full name, phone, city, country, notes.
5. If this customer is signing up because someone referred them, paste
   their **Referral code** into the field near the bottom — see
   [§12](#12-referrals--how-it-actually-works) for how that code reaches
   you.
6. Click **Create customer**.

### Edit a customer, change their status, or reset their password

From the customer's detail page or the row-actions menu (⋯) on the list:

- **Edit** opens a form for their contact details and notes.
- **Change status** — Active / Inactive / Suspended / Banned, with an
  optional reason.
- **Reset password** — generates a new one and shows it to you **once**.
  Copy it immediately; it can't be retrieved again afterward. Give it to
  the customer yourself.

### Import many customers at once

1. On the Customers page, click **Import**.
2. Choose an `.xlsx` file with (at minimum) **Email** and **Username**
   columns — Full name, Phone, City and Country are optional. Column
   headers are matched loosely (case and spacing don't matter).
3. Wait for the file to be **parsed** — nothing is written to the database
   yet.
4. You'll see a table of every row: valid rows are **pre-ticked**; rows
   with a problem are shown with the specific reason (bad email, duplicate
   username, etc.) and can't be ticked.
5. Untick any row you don't want to import.
6. Set a shared **password** for every imported customer, and an owner if
   you're a master.
7. Click **Import** (it shows the ticked count, e.g. "Import 12"). Rows
   are written **all together or not at all** — if any ticked row fails at
   this final step (e.g. someone else just took that email), nothing from
   the batch is saved.

### Export the customer list

Click **Export** at the top of the Customers page — downloads an `.xlsx`
of exactly what's currently filtered and visible.

---

## 7. Transactions

*Who can: everyone within their own scope. Every recorded entry is
attributed to whoever entered it.*

### Record a transaction

You can do this two ways:

- From **Transactions** in the sidebar, click **Record entry** — you'll
  pick which customer it's for as part of the form.
- From a customer's own detail page (see [§6](#6-customers)), click
  **Record entry** there — the customer is already chosen for you.

Either way:

1. Choose **Debit** (money in) or **Credit** (money out) — two labelled
   buttons, not a dropdown.
2. Enter the **amount**, pick the **game** it relates to, and the
   **channel** (cash, bank, wallet, etc.).
3. Optionally add a reference number or note.
4. Click **Record**.

Amount, type and customer can't be changed after saving — a wrong figure
is fixed with a correction (below), not an edit, so there's always a
trail.

### Fix a mistake with a correction

Transactions are never edited or deleted after the fact — a wrong entry is
fixed by recording a **correction** against it, which leaves both the
original and the fix visible.

1. Find the transaction in the list or on the customer's page.
2. Use the row action **Correct this entry**.
3. Enter the amount to reverse (up to, but not exceeding, the original) and
   a **reason**.
4. Click **Submit**. The correction appears as its own row, marked as a
   correction, linked back to the original — it is never counted as a
   withdrawal.

### Filter transactions

Above the list: search, transaction **type**, a **date range**, and an
**amount range**. The amount range has both a slider (drag either end for
a quick range) and exact-figure boxes next to it if you need a precise
number the slider can't land on.

### Export

**Export** button at the top of the Transactions page, same as customers.

---

## 8. VIPs

*Who can: only a **master** defines criteria. Everyone reads the resulting
qualifications within their own scope.*

VIP status is **computed**, never typed in by hand — it's the output of a
criteria run against recorded transaction activity.

### Define a VIP criteria (master only)

1. Go to **VIPs** in the sidebar. Criteria sit in their own section above
   the qualifications list.
2. Click **New criteria**.
3. Give it a **name** and **tier** number.
4. Choose the **metric** it measures (total debit, net, or transaction
   count), a **threshold** amount, and the **date window** it applies to.
5. Click **Create**.

### Recompute

If recorded activity has changed and you want qualifications refreshed
against the current data, use **Recompute qualifications** on a criteria
row's menu.

### View who currently qualifies

The main table on the VIPs page — filter by **tier** or **currently
qualifying only**. A lapsed qualification (from an earlier period) stays
on the record rather than disappearing, marked as **lapsed**.

---

## 9. Spin events and winners

*Who can: master creates events; everyone views winners within scope;
recording post-draw winners needs manager/master.*

Every spin event runs against an active VIP criteria — only customers who
qualify under that criteria are eligible.

### Create a spin event (master)

1. Go to **Spins** in the sidebar. Events sit above the winners list they
   produce.
2. Click **New event**.
3. Give it a **name** and pick the **VIP criteria** it runs against.
4. Choose how winners are decided:
   - **Preselected** — you pick the winners now, before the draw. You'll
     be asked to select them (only customers who already qualify under the
     chosen criteria are offered) as part of this same form.
   - **Post-draw** — winners aren't known yet; you'll record them after
     the actual draw happens (see below).
5. Set the **prize pool** and a schedule.
6. Click **Create event**.

### Record winners after a post-draw event

1. Find the event in the **Spin events** section (only shown here if it's
   post-draw and doesn't already have winners).
2. Click **Record winners**.
3. Pick customers from the list — only those who qualify under the event's
   criteria are selectable — and set a prize and rank for each.
4. Click **Save**.

### View winners

The main table on the Spins page, filterable by event and date, sortable
by rank or prize amount.

---

## 10. Games

*Who can: everyone reads the catalogue; only a **master** can change it.*

### Create a game

1. Go to **Games** in the sidebar and click **New game**.
2. Enter a **name**, **code**, and optionally a **category** and
   **description**.
3. Optionally click the image field to **upload a cover image** — PNG,
   JPG, WEBP or GIF, up to 5MB. Anything else is rejected before it's
   saved.
4. Click **Create**.

### Edit or retire a game

1. On the Games list, click the **pencil icon** on the game's row (master
   only — everyone else can look but not touch).
2. Change any field, including the cover image.
3. To retire it (or bring it back), untick or tick the **Active**
   checkbox in the same form — there's no separate "retire" button, it's
   just this one field.
4. Click **Save**.

### View a game's detail page

Click the **eye icon** on its row, or click the row itself — shows the
image, code, category, description, and when it was added.

---

## 11. Staff

*Who can: master sees and manages everyone; a manager sees and manages
only their own runners.*

### Create a staff member

1. Go to **Staff** in the sidebar and click **New staff**.
2. Enter **username**, **email**, **password**, **first/last name**.
3. Choose a **role** — a master can create managers or runners; a manager
   can only create runners under themselves.
4. Click **Create**.

### Deactivate or reset a staff member's password

Row-actions menu (⋯) on the Staff list — same pattern as customers:
**Deactivate**, or **Reset password** (shown once, copy it immediately).

A master can act on anyone; a manager only on their own runners — this
mirrors what the row actions offer, not just what the API allows.

---

## 12. Referrals — how it actually works

*Who can: master defines programs and reads everything; everyone issues
codes and reads their own scope's ledger. Customers get a link, never a
program.*

This is the feature most worth walking through end to end, since the
pieces (program → code → link → new signup → reward) aren't obvious from
any single screen.

### Step 1 — Master creates a referral program

1. Go to **Referrals** in the sidebar. Programs sit above the ledger they
   produce.
2. Click **New program**.
3. Name it, and set:
   - **Reward type** — fixed amount or a percentage.
   - **Referrer bonus** — what the person who refers earns.
   - **Referee bonus** — what the new customer earns.
   - **Minimum qualifying deposit** — how much the new customer must
     deposit before either bonus pays out.
   - A **valid from** date (and optionally a **valid to**).
4. Click **Create program**.

Reward type and start date can't be changed once codes have been issued
under the program — editing later only lets you adjust everything else
(bonus amounts, end date).

### Step 2 — Issue codes to customers

1. On the same Referrals page, find the program and click **Issue codes**.
2. Search for and select one or more customers — anyone already holding a
   code under this program is shown disabled with their existing code, so
   you can't double-issue.
3. Click **Issue** (it shows the count, e.g. "Issue 3"). Each selected
   customer gets their own unique code and link.

### Step 3 — What the customer sees and does with it

The customer signs into their own portal (`/customer`) and sees, on their
dashboard:

- A **"Your referral link"** card with the full shareable URL and a
  **copy button**.
- The bare code underneath, for anyone they'd rather tell directly than
  send a link to.
- Running totals: how many people they've referred, how many converted,
  and how much they've earned.

A customer who **doesn't** have a code yet sees an explanation instead of
an empty space — codes are issued by staff, not self-served, and the card
says so.

### Step 4 — Someone clicks the link

The link (`/r/{code}`) is public — no sign-in required, since whoever
clicks it doesn't have an account yet. It shows the program's offer (what
they'll earn, what they need to deposit) and the code itself, with a note
that accounts here are set up by the team, not self-registered — so what
they do with that code is hand it to whoever signs them up.

### Step 5 — Staff creates the new customer with the code

When creating the new customer (see [§6](#6-customers)), paste the code
into the **Referral code** field. An unusable code (expired, already used
up) is silently ignored rather than blocking the signup — the create still
succeeds, it just doesn't attach a referral.

### Step 6 — It shows up as `pending`

Back on the Referrals page's ledger, the new pair (referrer → referee)
appears immediately with status **pending** — the code was used, but the
reward hasn't triggered yet.

### Step 7 — The reward triggers automatically

The moment the new customer's recorded deposits reach the program's
minimum qualifying amount (via an ordinary transaction entry, see
[§7](#7-transactions)), the referral flips to **rewarded** on its own —
nothing to click. Both the referrer's and referee's **bonus balance**
(shown on the customer record and the customer's own dashboard, kept
separate from their real balance) update to reflect it.

### Viewing and filtering the ledger

The main table on the Referrals page — filter by status (pending /
qualified / rewarded / rejected), program, customer, or date. **Export**
is available here too.

---

## 13. Broadcast (email campaigns)

*Who can: master and manager. A runner doesn't have this in their
sidebar.*

Messaging (§14) is one thread per customer; Broadcast is the only way to
reach many customers with one email.

### Compose and send a campaign

1. Go to **Broadcast** in the sidebar and click **New broadcast**.
2. Write the **subject** and body (plain text is required; you can also
   supply HTML).
3. Choose an **email kind** — promotional, informational, notification,
   transactional, or alert. This isn't cosmetic: it decides layout and
   whether an unsubscribe footer appears, since transactional/security
   mail is never unsubscribable.
4. Build the **audience** — either a one-click quick filter (all active,
   has transacted, high spenders, etc.) or your own combination of spend,
   location and activity filters.
5. Click **Preview audience** and wait for the count. **You cannot send
   until this has run** — and it re-runs automatically if you change the
   filter afterward, so the number on screen always matches what you're
   about to send to.
6. Review the count (and how many are excluded — no address, opted out, or
   previously bounced — shown separately so it isn't hidden inside the
   total).
7. Click **Send broadcast**, and confirm — the dialog names the exact
   number of recipients.

### Check on a campaign afterward

- **View recipients** (row-actions menu) shows per-address delivery status
  and, for a failure, why. **Export** is available here too, scoped to
  just that campaign.
- **Cancel sending** is offered only while a campaign is still queued or
  sending — once mail has gone out there's nothing left to cancel.

---

## 14. Messaging

*Who can: everyone, within their own scope. A manager sees their runners'
conversations too; a runner sees only their own.*

There's one continuous thread per customer — not per topic — and it's
available two ways that share the same data and update live:

### The floating chat bubble

Available on every page.

1. Click the **message icon**, bottom-right. A red badge shows your total
   unread count even when it's closed.
2. The panel opens on your **inbox** — a list of conversations, most
   recent first, unread counts per conversation.
3. Click a conversation to open the **thread**.
4. Type in the box at the bottom and press **Enter** or click **Send**.
5. Click the **expand icon** in the panel header to jump to the full page
   instead.

### The full Messages page

1. Go to **Messages** in the sidebar.
2. Use the **search box** above the list to filter by customer name or
   message content — it filters instantly as you type, no page reload.
3. Click a conversation on the left to open it on the right (on a phone,
   the thread replaces the list instead of sitting beside it).
4. Type and send the same way as the bubble.

### Sending an attachment

From either surface:

1. Click the **paperclip icon** next to the message box.
2. Choose one or more files — images (PNG/JPG/WEBP/GIF), PDF, Word,
   Excel, CSV, plain text, or a zip. Up to 15MB each, up to 10 files per
   message.
3. Each file starts uploading immediately — you'll see it as a small chip
   above the message box with a progress spinner, then a thumbnail once
   it's done. Click the **×** on a chip to remove it before sending.
4. You can send with **just an attachment and no text**, or attach
   something alongside a message — either works.
5. Click **Send**. In the thread, images show inline; other files appear
   as a named, sized chip you can click to open.

### Knowing whether you're seeing messages live

Look for the small indicator near the inbox header: a **green dot/"Live"**
means new messages will appear instantly without refreshing; a
**"Not live"** state means the connection dropped and you may need to
refresh to see the latest.

---

## 15. Audit trail

*Who can: **master only**. Deliberately unscoped — it exists to be read by
someone outside whatever chain is being reviewed.*

1. Go to **Audit trail** in the sidebar (not shown to manager or runner).
2. Every state-changing action in the system appears here: who did it,
   when, from where, and what request it belonged to — including refused
   attempts (a runner trying another chain's customer, for instance).
3. Filter by **actor type**, **action**, **entity**, **correlation ID**, or
   date range — filtering by correlation ID is the way to pull every log
   line tied to one specific request.
4. **Export** is available here too.

---

## 16. Exporting a list

Every list in the system that supports it has an **Export** button near
its top (sometimes inside a sub-section, like a specific campaign's
recipients, or a program's issued codes).

1. Set whatever filters you want on the list first.
2. Click **Export**.
3. A `.xlsx` file downloads, matching exactly what's filtered and visible
   — never the whole table regardless of your filters.

---

## 17. The customer portal

*Who can: a signed-in customer, for their own record only. Nothing here
is editable — every field is something the team maintains on the
customer's behalf.*

### Overview (dashboard)

Landing page after customer sign-in:

- **Balance** and **bonus balance** (referral earnings, kept separate).
- **Total deposited** / **total withdrawn**.
- **VIP standing** — computed from activity, never set by hand.
- **Messages** — unread count, with a button straight into the thread.
- **Referral link**, if one has been issued — see
  [§12, Step 3](#12-referrals--how-it-actually-works).
- **Recent wins** — spin prizes, if any.

### Profile

Click **Profile** in the portal header — shows username, email, status,
balance figures. Entirely read-only; there's no save button anywhere on
this page, by design.

### Messages

Click **Messages** in the portal header, or the unread-messages button on
the dashboard. Same thread, same attachment support, as the staff side —
see [§14](#14-messaging).

---

## 18. Appendix: who can do what

| Area | Master | Manager | Runner | Customer |
| --- | :---: | :---: | :---: | :---: |
| Own customers/transactions | ✅ all chains | ✅ own chain | ✅ own only | — |
| Create/edit customers | ✅ (must set owner) | ✅ | ✅ | ❌ |
| Record transactions/corrections | ✅ | ✅ | ✅ | ❌ |
| VIP criteria (define) | ✅ | ❌ read-only | ❌ read-only | ❌ |
| Spin events (create) | ✅ | ❌ read-only | ❌ read-only | ❌ |
| Games (create/edit) | ✅ | ❌ read-only | ❌ read-only | ❌ |
| Staff (create/manage) | ✅ everyone | ✅ own runners | ❌ | ❌ |
| Referral programs (define) | ✅ | ❌ read-only | ❌ read-only | ❌ |
| Referral codes (issue) | ✅ | ✅ | ✅ | ❌ (receives only) |
| Broadcast / email campaigns | ✅ | ✅ | ❌ | ❌ |
| Messaging | ✅ all scope | ✅ own scope | ✅ own only | ✅ own thread |
| Audit trail | ✅ | ❌ | ❌ | ❌ |
| Exports | ✅ all | ✅ own scope | ✅ own scope | ❌ |
| Edit own profile / password | ✅ | ✅ | ✅ | ❌ (staff-managed) |

A row you can't see returns **"Not found,"** never "forbidden" — this
applies everywhere in the table above marked ❌.
