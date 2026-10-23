# Tenfold: play, give, win

A subscription web app for golfers. Members log their latest Stableford scores, those scores become their numbers in a monthly prize draw, and part of every membership goes to a charity they choose.

Built for the **Digital Heroes PRD (Level 1)** trainee assignment.

| | |
|---|---|
| **Frontend** | React 19 + Vite, React Router, Framer Motion, hand-written CSS |
| **Backend** | Supabase (Postgres, Auth, Storage, Row Level Security) |
| **Server functions** | Vercel Functions in `/api` (Stripe and the draw engine) |
| **Payments** | Stripe Checkout + webhooks (test mode) |
| **Hosting** | Vercel |

**Live site:** _add your Vercel URL here_
**Test accounts:** see [Test credentials](#test-credentials)

---

## Features mapped to the PRD

| PRD section | Where it lives |
|---|---|
| §03 Roles: visitor / subscriber / admin | Public pages, `/dashboard`, `/admin` (route guards + RLS) |
| §04 Monthly + yearly plans, Stripe, lifecycle | `api/checkout.js`, `api/stripe-webhook.js`, `api/subscription.js` |
| §04 Real-time status check | `has_active_subscription()` in SQL used by RLS on every score write, plus a re-check on every navigation (`Guards.jsx`) |
| §05 Rolling 5 scores, 1–45, one per date | `scores` table + triggers in `supabase/schema.sql`, `ScoreManager.jsx` |
| §06 Random / algorithmic draw, simulate, publish | `src/lib/drawEngine.js`, `api/admin/draw.js`, `admin/Draws.jsx` |
| §07 40/35/25 split, equal shares, jackpot rollover | `drawEngine.js` (`splitPool`, `settleDraw`), unit-tested |
| §08 Charity choice, min 10%, extra %, independent donation | Signup, dashboard, `api/donate.js`, `donations` ledger |
| §08.2 Directory, profiles, events, homepage spotlight | `/charities`, `/charities/:slug`, home page |
| §09 Winner proof upload, approve / reject, Pending → Paid | `Winnings.jsx`, `admin/Winners.jsx`, private storage bucket |
| §10 User dashboard (all five modules) | `pages/Dashboard.jsx` |
| §11 Admin: users, draws, charities, winners, reports | `pages/admin/*` |
| §12 Non-golf, emotion-led, animated, strong CTA | Charity-first homepage, animated draw "ticket", prominent Subscribe |

---

## How ambiguous requirements were resolved

The PRD says ambiguity is part of the test. These are the gaps I found and the decision taken for each.

### Scores and draw numbers
1. **How do scores become draw numbers?** The PRD never says. A member's **5 stored scores are their ticket**. Five distinct numbers from 1–45 are drawn, and a ticket's matches are how many of its values appear among them. This uses the score range (1–45) as the number range, so no separate number picking is needed.
2. **Duplicate score values** (e.g. 30 twice): a value counts **once** for matching, so that ticket can match at most 4 numbers. This is shown in the FAQ.
3. **Who is eligible?** Members with an **active subscription at draw time AND exactly 5 scores**. ("Users must enter their last 5 scores.") Members with fewer scores sit that draw out, but their charity contribution still counts.
4. **Which score is "oldest"?** It's judged by the **date played**, not the date entered. Adding a round dated earlier than all 5 stored rounds is **rejected with a clear message**, because otherwise it would be stored and then deleted instantly.
5. **Future dates** are rejected (with a 1-day allowance for time zones).
6. **Editing:** members can change a score's value or date. The one-per-date rule still applies. Delete is allowed too.
7. **Scores are frozen at publish time.** Each draw entry stores a snapshot of the ticket, so later edits don't change past results.

### Algorithmic draw
8. **"Weighted by score frequency"** doesn't say in which direction. Admins choose: favour the **most common** scores (more winners) or the **least common** (fewer winners, bigger rollovers). Every number keeps a base weight of 1, so any number can still be drawn.

### Prize pool
9. **"A fixed portion of each subscription"** is set at **30%** of the fee (`PRIZE_POOL_SHARE` in `src/config/plans.js`).
10. **Yearly plans** contribute **1/12 of the yearly fee each month**, so yearly members don't flood one month's pool.
11. **Pool is calculated from active subscribers at the moment of the draw.** This matches "auto-calculation based on active subscriber count".
12. **Unwon 4- and 3-match pots:** the PRD says they don't roll over but not where they go. They are recorded on the draw as **`unclaimed_cents`** and retained by the platform. This is visible in admin reports.
13. **Rounding:** money is stored as integer pence. Each tier is split equally and rounded **down**. Leftover pennies from the jackpot roll over, and from the 4/3 tiers they count as unclaimed. Every penny is accounted for, and this is covered by a test.
14. **Rollover chain:** draws must be **published in month order**. Publishing is blocked if the previous month changed after the simulation, and the admin is asked to re-simulate.
15. **Simulation vs publish:** a simulation stores the full result privately. **Publish releases exactly what the admin reviewed**. Numbers are never re-drawn on publish. Simulations can be re-run or discarded, and published draws can't be changed.

### Charity
16. **Maximum charity %:** the PRD only sets a minimum (10%). It is capped at **60%** so the fixed 30% prize share and a minimum 10% platform share always fit.
17. **When is the charity paid?** On **every paid invoice** (first payment and each renewal), the member's current % is recorded in the `donations` ledger against their current charity. Changes apply from the next payment.
18. **Independent donations** go through Stripe Checkout in payment mode. They work for signed-out visitors, go 100% to the charity, and have no effect on the draw.
19. **Deleting a charity** keeps past donations (set to null). Admins can **hide** a charity instead.

### Subscriptions
20. **Lifecycle states:** active, trialing, past_due (payment failed), canceled, lapsed (period ended), inactive. Access is granted only when status is active/trialing **and** the paid period hasn't ended, so a missed webhook can never give free access.
21. **Cancellation** happens at the **end of the paid period** (the member keeps access), and the member can undo it. Admins can also end immediately.
22. **Webhook resilience:** the checkout success page confirms the session with Stripe directly, so membership activates even if the webhook is slow or not configured. Webhooks and the success page are idempotent.
23. **Complimentary access:** admins can grant manual (non-Stripe) memberships for support cases and test accounts.

### Winners
24. **Proof** is an image (≤5 MB) in a **private** bucket that only the winner and admins can read. Admins open it through a time-limited signed URL.
25. **Rejected proofs** need a note from the admin, which the member sees. The member can then upload again.
26. **Payout** can be marked Paid only after approval.

---

## Data model

```
auth.users ─1:1─ profiles ──┬── subscriptions (1:1, mirrors Stripe)
                            ├── scores (rolling 5, unique per date)
                            ├── draw_entries ── draws
                            ├── winners ─────── draws
                            └── donations ───── charities
profiles.charity_id ──────────────────────────── charities
```

* All money is in integer **pence** (`*_cents`).
* **RLS is on for every table.** The browser uses the anon key: members read and write only their own rows, admins (`is_admin()`) can manage everything, and subscription and payment rows are written only by server code using the service-role key.
* Members can't promote themselves to admin. A trigger blocks role changes unless an admin makes them.
* `platform_stats()` and `charity_totals()` expose public totals with no personal data.

## Project structure

```
api/                    Vercel Functions (server-only, service-role key)
  _lib/                 shared helpers (not deployed as endpoints)
  checkout.js           start subscription checkout
  checkout-status.js    confirm a checkout on return from Stripe
  stripe-webhook.js     renewals, cancellations, lapses, donations
  subscription.js       member cancel / resume
  donate.js             one-off donation checkout
  admin/draw.js         simulate / publish / discard draws
  admin/subscription.js admin subscription actions
src/
  config/plans.js       prices, splits, rules (shared by app and API)
  lib/drawEngine.js     pure draw + prize logic (unit-tested)
  context/              auth + membership state
  components/           shared UI
  pages/                public + member pages
  pages/admin/          admin panel (code-split)
supabase/
  schema.sql            tables, triggers, RLS, storage, functions
  seed.sql              starter charities
scripts/seed-demo.mjs   creates admin + test member + demo members
```

## Scalability notes

* Business rules live in one config file and the draw engine is a pure module, so new tiers, currencies or draw modes don't touch the UI.
* Draw tickets are snapshotted per draw, so history stays correct as scores change.
* Indexes on `(user_id, played_on)` and unique keys support idempotent webhooks and fast lookups.
* Admin code is lazy-loaded, so members never download it.
* Multi-country support would mean adding currency to `plans.js` and `subscriptions.currency` (already stored per row).

## Running locally

```bash
npm install
cp .env.example .env        # fill in keys (see SETUP.md)
npm test                    # draw engine unit tests
npm i -g vercel && vercel dev   # app + /api on http://localhost:3000
```

`npm run dev` runs only the React app (no `/api`), which is fine for UI work.

## Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@tenfold.demo | Tenfold!Admin2026 |
| Member | player@tenfold.demo | Tenfold!Player2026 |

Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.
