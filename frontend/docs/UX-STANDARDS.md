# Frontend UX standards

Eight bars this frontend is measured against. They are acceptance criteria,
not aspirations: a change is not done until it holds against all eight, and
anything shipped short of them is recorded below as short rather than
quietly left to look finished.

The audit column is re-checked at each milestone. `❌`/`⚠️` entries are the
work queue, in priority order.

| #   | Bar                                                             | Baseline (2026-08-04)                                                | Now (2026-08-04, verified against a running API)                              |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Alerts, animations, experience                                  | ⚠️ skeletons and an error boundary only; no toasts, no confirmations | ✅ toasts on every mutation, confirm dialogs, pending states, skeletons       |
| 2   | Personalization                                                 | ⚠️ role-filtered nav; dark tokens defined but unreachable            | ✅ light/dark/system switch, role-shaped nav and copy                         |
| 3   | Feature oriented — nothing advertised may 404                   | ❌ 9 dead links; 3 of 11 destinations existed                        | ✅ zero dead links; 8 areas built, 3 unbuilt and therefore unadvertised       |
| 4   | Actions, icons, arrangement, modern theme                       | ⚠️ read-only; no write actions, no row actions                       | ⚠️ row actions and writes on customers and staff; other areas still read-only |
| 5   | Mobile responsiveness                                           | ❌ no navigation at all below `md`                                   | ✅ drawer nav, scrolling tables, stacking controls                            |
| 6   | Preview / real-time across components, sections, pages, metrics | ❌ none; Socket.IO backend unused                                    | ❌ **not started** — Socket.IO still unused                                   |
| 7   | Visualizations — line, dot, interactive charts                  | ❌ none; no chart layer                                              | ✅ trend line + dot plot, crosshair tooltips, table view, validated palette   |
| 8   | List filters and searches utilized                              | ⚠️ search only; filters plumbed with no controls                     | ✅ every accepted filter has a control, chips, sortable headers               |

### What bar 3 currently means

Nothing in the UI 404s. Built and navigable: dashboard, customers (list +
detail), transactions, VIPs, spin winners, games, staff, audit trail.

Three API areas still have no page, and therefore no nav entry:

**messaging · email campaigns · exports**

Add each nav entry in the same commit as its page, never before.

### A note on status codes

Role-gated pages call `notFound()`, which renders the "not found" page. The
HTTP status is still 200 because the layout shell has already been flushed
by the time the page body runs — that is how streaming SSR works, and it is
not a gating failure. What matters is verified: a runner sent to `/staff`
sees "not found", and their sidebar never offers the link.

---

## What each bar means in practice

**1. Alerts, animations, experience.** Every mutation reports its outcome —
success and failure — through a toast, not a silent re-render. Destructive
actions confirm first. Motion is short and purposeful: skeletons while
loading, transitions on state change, nothing that delays input.

**2. Personalization.** More than hiding nav links. The signed-in user's
role shapes what the page says and offers, and the theme (light/dark) is a
reachable, remembered choice.

**3. Feature oriented.** Every link in the navigation and every link in a
table row resolves to a real page. A destination that is not built yet is
not advertised. This bar is binary.

**4. Actions, icons, arrangement, modern theme, silky and smooth.** The app
is something staff _work in_, not a report they read: create, edit, and
manage from the list they are already looking at. Row actions where the row
is. Consistent icon language throughout.

**5. Mobile responsiveness.** Full navigation below 768px, tables that
scroll rather than overflow, controls that stack instead of crowding. Staff
do data entry on phones.

**6. Preview and real-time.** The API runs Socket.IO. Messaging updates
live, and metrics refresh without a manual reload.

**7. Visualizations.** Line graphs for trends over time, dot/scatter where
distribution matters, and charts that respond to hover and selection. Stat
tiles are a supplement to this bar, not a substitute for it.

**8. Filters and search.** Every filter the API accepts has a control in the
UI. A query parameter forwarded from the URL with nothing to set it does not
count. Filter state lives in the URL so a filtered view is shareable.

---

## Rules that outrank the bars

Two constraints from the API side that a nicer-looking UI must never
trade away:

- **A 404 is rendered as "not found", never as "forbidden" or "no access".**
  The API makes a missing record and another chain's record deliberately
  indistinguishable; wording that distinguishes them undoes the scoping.
- **Money stays a string end to end.** It is `numeric(18,2)` in Postgres and
  serialised as a string. It is never parsed into a JS number for display,
  sorting, or charting.
