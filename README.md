# RAILVYN

**--Every journey. Precisely placed.--**

A database-first railway coach and **journey-aware seat allocation** system. RAILVYN sells a berth for exactly the leg you travel, releases it the moment you alight, and protects every allocation with PostgreSQL segment claims — so the same physical seat can be sold twice in one day, but never twice on the same stretch of track.

[![Live demo](https://img.shields.io/badge/Live%20demo-railvyn.vercel.app-C6F26B?style=for-the-badge&labelColor=101312)](https://railvyn.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-087EA4?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![Better Auth](https://img.shields.io/badge/Auth-Better%20Auth-000?style=flat-square)](https://better-auth.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

> [!IMPORTANT]
> **RAILVYN is an independent educational/demonstration project — not IRCTC or Indian Railways.**
> It does not connect to government APIs, real railway inventory or payment gateways. Booking
> references are internal `RVN-…` identifiers, **never official PNRs**. Every train, station,
> fare and seat you see is seeded demonstration data, labelled as such throughout the app.

![RAILVYN landing page](docs/screenshots/landing.png)

---

## Contents

[Try it now](#try-it-now) ·
[The core idea](#the-core-idea-journey-aware-inventory) ·
[What's inside](#whats-inside) ·
[Screens](#screens) ·
[Architecture](#architecture) ·
[Booking correctness](#booking-correctness) ·
[Tech stack](#tech-stack) ·
[Run it locally](#run-it-locally) ·
[Testing](#testing) ·
[Deployment](#deployment) ·
[Scripts](#scripts) ·
[Project layout](#project-layout) ·
[Known limitations](#known-limitations) ·
[Disclaimer](#disclaimer)

---

## Try it now

**Live app:** <https://railvyn.vercel.app>

Every seeded account uses the same password: **`RailvynDemo#2026`**

| Account | Role | What to look at |
| --- | --- | --- |
| `passenger@railvyn.demo` | Passenger | Search → coach map → hold → demo checkout → ticket → cancel |
| `operator@railvyn.demo` | Operator (scoped) | Only their assigned runs, coach × segment occupancy, waitlists, disruptions |
| `operator2@railvyn.demo` | Operator (different scope) | Confirms scope isolation — they cannot see operator 1's runs |
| `admin@railvyn.demo` | Administrator | Network, trains, runs, coaches, users, pricing, analytics, audit log |

A five-minute tour:

1. **Search** a journey (e.g. New Delhi → Kanpur Central, any of the next 7 days).
2. Open a run → **inspect the coach map**. Berths free only for *your* segments show as available.
3. Select seats → **hold for 5 minutes** → enter traveller details → complete the **demo** checkout.
4. Note the `RVN-…` reference on the ticket. **Cancel** it and watch the claims release.
5. Sign in as the operator and see the same run's occupancy by coach and by segment.

> The free Neon compute suspends when idle, so the very first query after a quiet period can take a couple of seconds while it wakes.

---

## The core idea: journey-aware inventory

A run visits stops `0 … N`, which creates travel **segments** `0 … N-1`. A journey
from stop `a` to stop `b` occupies the half-open range `[a, b)` — every segment in it.

```
Stops      0        1        2        3        4
         NDLS ─── CNB ─── PRYJ ─── DDU ─── HWH
Segments   [0]      [1]      [2]      [3]

Passenger A   NDLS → CNB    claims [0,1)   segment 0
Passenger B   CNB  → HWH    claims [1,4)   segments 1,2,3   ← legal, adjacent to A
Passenger C   NDLS → PRYJ   claims [0,2)   segments 0,1     ← overlaps A and B, rejected
```

The rule is enforced by the database, not by the UI:

```sql
UNIQUE (run_seat_id, segment_index)   -- seat_segment_claims
```

One row per occupied segment per physical seat per run. Two passengers may share a
berth across adjacent legs; two passengers can never own the same segment. Holds and
confirmed bookings both own claims, so an expired hold and a live booking compete under
the same constraint, inside the same transaction.

**Why this matters:** a naive `seat.status = 'booked'` column throws away half the
capacity of a long-distance train. RAILVYN's occupancy is per segment, so a seat sold
Delhi→Kanpur is legitimately resellable Kanpur→Howrah the same day.

---

## What's inside

### Passenger

- Search by boarding station, alighting station, date, class and party size.
- Stop timeline for every run, with per-segment availability and distance-priced fares.
- Interactive coach map — coach tabs, berth labels, accessible berths, seat preferences —
  plus a keyboard-friendly **list view** alternative.
- Timed hold (default 5 minutes) with live availability refresh from the server.
- Traveller details, unmistakably labelled demo checkout, internal ticket, cancellation.
- FIFO/priority **waitlist** when the requested class is full for the exact leg.
- Dashboard, my bookings, ticket details, profile and password change.

### Operator (scoped to assigned trains)

- Overview of only their runs — runs outside their scope are neither listed nor operable.
- Coach × segment occupancy console, live holds, booking registry, staff cancellation.
- Guarded seat reassignment that respects existing claims.
- Waitlist queue resolution and disruption logging per run.
- Resolving the last open incident returns a flagged run to `scheduled`.

### Administrator

- System dashboard backed by real aggregates, not placeholders.
- Network: stations, routes, strictly contiguous ordered stops (`stop_index 0..N`).
- Trains, dated run generation, coach templates and per-run coach composition.
- Users, role grants, explicit operator train scopes, administrator password resets.
- Segment fares by route, class and stop pair; pricing and policy settings.
- Analytics: occupancy %, booked segments, **seat reuse**, cancellation rate, class
  utilisation, waitlist ageing and disruption impact.
- Searchable audit log of privileged actions.

---

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing: the reuse model, truth boundary, entry points |
| `/search` | Station pair, date, class and party size |
| `/trains/[runId]` | Run details and stop timeline |
| `/book/[runId]/seats` | Interactive coach map + list alternative |
| `/book/[runId]/passengers` | Traveller details |
| `/checkout/[holdId]` | Timed hold and demo payment |
| `/booking/result` | Booking result and reference |
| `/login`, `/signup`, `/forgot-password` | Credentials auth |
| `/dashboard`, `/my-bookings`, `/my-bookings/[id]`, `/profile` | Passenger area |
| `/operator`, `/operator/runs/[runId]`, `/operator/bookings` | Operations cockpit |
| `/operator/waitlist`, `/operator/disruptions` | Queue and incident management |
| `/admin`, `/admin/network`, `/admin/trains`, `/admin/runs` | Network and timetable admin |
| `/admin/coaches`, `/admin/users`, `/admin/pricing` | Inventory, roles, fares |
| `/admin/analytics`, `/admin/audit`, `/admin/settings` | Reporting, trail, policy |
| `/api/auth/[...all]` | Better Auth handler |
| `/api/runs/[runId]/availability` | Server-revalidated availability |

| Journey search — per-leg availability | Coach map — berths, types, accessible seats |
| --- | --- |
| ![Search results](docs/screenshots/search.png) | ![Coach map](docs/screenshots/coach-map.png) |
| **Run timeline — stops, fares, composition** | **Mobile layout** |
| ![Run details](docs/screenshots/run-details.png) | ![Mobile landing](docs/screenshots/landing-mobile.png) |

---

## Architecture

```
Browser
  │   React Server Components + client components
  ▼
Vercel · Next.js 16 App Router (Node.js runtime)
  │   server actions · /api/auth/* · /api/runs/:id/availability
  │   route groups: (public) (auth) (passenger) (operator) (admin)
  ▼
src/lib/domain   allocation · reservations · availability · waitlist
                 fare · analytics · audit        (server-only)
  │
  ▼
Drizzle ORM (postgres-js, prepare: false — pooler compatible)
  │
  ▼
Neon PostgreSQL   UNIQUE (run_seat_id, segment_index) · FKs · CHECKs
                  transactional booking, lazy hold expiry
```

**Layering rules**

- UI never writes inventory. Every mutation goes through server actions or route
  handlers → domain services in `src/lib/domain/` → PostgreSQL.
- Reads for operator and admin screens use `src/lib/queries/` read models.
- Every action validates input with **Zod**, resolves the session and role **on the
  server**, checks operator train scope, and writes privileged actions to `audit_logs`.
- Admin pages guard before querying, because App Router layouts and pages render in
  parallel; the route-group layout additionally supplies the admin chrome.
- Availability polls the server (5–10s, on demand) and is **always revalidated at
  commit time**. Cached UI state never decides who gets a seat.
- No WebSocket servers, no long-running workers — everything is request-scoped and
  safe for serverless.

### Entity model

Auth: `users`, `sessions`, `accounts`, `verifications` (Better Auth), `role_assignments`,
`operator_scopes`.

Network: `stations`, `routes`, `route_stops`, `trains`, `train_runs`.

Inventory: `coach_templates`, `template_seats`, `run_coaches`, `run_seats`.

Bookings: `bookings`, `booking_passengers`, `booking_seats`, `seat_holds`, `hold_seats`,
`seat_segment_claims`, `waitlist_entries`, `fares`, `payments_demo`, `disruptions`,
`audit_logs`, `app_settings`.

---

## Booking correctness

1. **Validate** run, ordered stops, passenger count, fare, class, restrictions and actor.
2. **Allocate in a transaction**: clean up stale claims under lock, pick eligible seats by
   preference, insert the hold plus one claim per occupied segment, and retry safely on
   unique-constraint conflicts with alternative seats.
3. **Holds expire** after `HOLD_TTL_SECONDS` (default 300). Checkout requires a still-valid
   hold; confirmation converts hold → booking in the **same** transaction and is idempotent.
   A booking can never be confirmed without its claims.
4. **Cancellation** releases claims, marks records cancelled, writes an audit event and
   attempts a guarded FIFO/priority waitlist promotion — idempotently.
5. **Expired holds are cleaned lazily** by allocation and confirmation. Correctness does not
   depend on cron; a scheduled cleanup is an optional optimisation only (Vercel Hobby allows
   once-daily cron).
6. **Runs with booked segments** cannot have their physical seats silently deleted or
   rearranged — the API blocks the edit; use controlled reassignment.
7. **References are internal** `RVN-…` identifiers, never PNRs.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) |
| Database | Neon PostgreSQL + Drizzle ORM + versioned Drizzle Kit migrations |
| Auth | Better Auth (Drizzle PostgreSQL adapter), server-verified roles |
| UI | Tailwind CSS 4, shadcn-style Radix primitives, Lucide icons, Motion |
| Forms | Zod + React Hook Form |
| Tables / charts | TanStack Table, Recharts |
| Tests | Vitest (unit + PostgreSQL integration), Playwright configured |
| Hosting | Vercel (Node.js runtime for DB/auth routes) |

---

## Run it locally

**Requirements:** Node.js ≥ 20.9 and pnpm (`packageManager` pins `pnpm@12.16.1`).

```bash
pnpm install
cp .env.example .env.local
```

Set at least:

```dotenv
# Local embedded PostgreSQL started by `pnpm db:local`
NEON_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/railvyn

# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Terminal 1 — leave the database running:

```bash
pnpm db:local
```

Terminal 2:

```bash
pnpm db:setup   # migrate, then reset + seed demonstration data
pnpm dev
```

Open <http://localhost:3000> and sign in with any account from
[Try it now](#try-it-now).

### Point it at Neon instead

Put your **pooled** Neon connection string in `NEON_DATABASE_URL`, then:

```bash
pnpm db:migrate     # applies drizzle/
pnpm db:seed        # demo data only (destructive — resets app tables)
```

To load the large dataset as well:

| Command | Adds |
| --- | --- |
| `pnpm db:seed` | 63 stations, 30 trains, 300 dated runs, 100 bookings |
| `pnpm db:seed:bulk` | + 1,000 stations, 1,420 routes/trains, 9,940 runs, 19,880 coaches, 1,351,840 seats, 112,000 fares, 1,200 bookings, 1,200 waitlist entries, 1,000 disruptions |
| `pnpm db:seed:large` | Both, in order |

The bulk seed runs inside PostgreSQL (`db/bulk-seed.sql`) with deterministic IDs, is
idempotent, and guarantees **every station pair shares at least one route** with a daily
departure across the 7-day window.

> **Never** run `db:seed` or `db:seed:bulk` against a database whose data you want to keep.

### One-file SQL setup (Neon SQL Editor)

[`railvyn-neon-setup.sql`](railvyn-neon-setup.sql) contains schema + base seed + bulk dataset
in a single ~7.3 MiB file. Paste it into the Neon **SQL Editor** and press **Run**. It drops
and recreates `public`, so use a dedicated demo database, and **do not** also run
`pnpm db:migrate` on it. Regenerate with `pnpm db:sql:bundle` after schema/seed changes.

---

## Testing

```bash
pnpm db:local     # first — the Vitest global setup applies migrations to .env.test
pnpm test         # unit suite
pnpm test:all     # unit + PostgreSQL integration suites
pnpm test:e2e     # Playwright runner (specs under tests/e2e)
```

`.env.test` overrides `.env.local` for tests. Point `NEON_DATABASE_URL` there at a
**disposable** database (by default `railvyn_test` on port 5433).

Coverage today — **31 tests across 5 files, all passing** (`pnpm test:all`):

- Segment math and half-open `[a, b)` ranges, including adjacent non-overlapping legs.
- Overlapping vs adjacent allocation, hold → confirm → cancel invariants.
- Waitlist FIFO/priority promotion.
- Server-side operator scope authorization (integration).
- Reference generation format.

Static checks:

```bash
pnpm lint        # ESLint 9 flat config — 0 errors, 9 warnings (7 unused vars, 2 React Compiler notices)
pnpm typecheck   # tsc --noEmit, strict
pnpm build       # production build
```

---

## Deployment

Full walkthrough: **[`DEPLOYMENT.md`](DEPLOYMENT.md)**.

1. Create a Neon project, copy the **pooled** connection string.
2. `pnpm db:migrate` and optionally `pnpm db:seed` against it (or run the one-file SQL).
3. Import the repo into Vercel — Next.js preset, root directory `/`, `pnpm build`.
4. Set `NEON_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and
   `NEXT_PUBLIC_APP_URL`. `BETTER_AUTH_URL` must be the exact `https://` production domain,
   or sign-in breaks (production cookies are HTTPS-only).
5. Deploy, then verify sign-in, search, hold, demo checkout and cancellation.

The live instance runs this exact configuration: <https://railvyn.vercel.app>.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / production server |
| `pnpm lint` | ESLint 9 flat config |
| `pnpm typecheck` | Strict TypeScript check |
| `pnpm test` / `pnpm test:all` | Unit / unit + integration |
| `pnpm test:e2e` | Playwright |
| `pnpm db:local` | Embedded PostgreSQL on port 5433 |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply migrations from `drizzle/` |
| `pnpm db:seed` | Reset + seed base demo data |
| `pnpm db:seed:bulk` | Add the generated bulk dataset |
| `pnpm db:seed:large` | Both seeds in order |
| `pnpm db:setup` | `db:migrate` then `db:seed` |
| `pnpm db:sql:export` / `db:sql:bundle` / `db:sql:verify` | Build and check the standalone SQL files |

---

## Project layout

```text
src/app/(public)       Landing, search, run, coach map, checkout, result
src/app/(auth)         Sign in, sign up, password help
src/app/(passenger)    Dashboard, bookings, ticket, cancellation, profile
src/app/(operator)     Scoped operations cockpit and run console
src/app/(admin)        Network, trains, runs, coaches, users, pricing, analytics, audit
src/app/api            Better Auth handler, availability endpoint
src/lib/domain         Server-only allocation, availability, reservations, waitlist,
                       fare, analytics, audit
src/lib/queries        Read models for operator and admin screens
src/components         Layout, booking, operator, admin, passenger, forms, UI primitives
src/db                 Drizzle client and 27-table schema
drizzle/               Versioned SQL migrations
db/                    Standalone schema/seed/bulk SQL used for the one-file setup
scripts/               Local database, migration, seed, SQL export utilities
docs/screenshots/      Images captured from the live deployment
tests/                 Vitest unit + PostgreSQL integration suites
```

---

## Known limitations

Honest list, not a wishlist in disguise:

- **No email delivery.** Password resets are performed by an administrator, which also signs
  out existing sessions.
- **Payments are simulated.** No card fields, no provider, no refunds.
- **References are not PNRs.** They are internal `RVN-…` identifiers.
- **Playwright journeys are not committed yet.** The runner and config are present; Vitest
  covers the domain layer and key database invariants.
- **ESLint reports warnings, not errors** — two TanStack Table React Compiler notices and
  seven unused-variable warnings across a few components and scripts.
- **Preview deployments won't authenticate** while `BETTER_AUTH_URL` is pinned to the
  production domain. Keep auth env vars scoped to Production, or give previews their own
  database and domain.
- **Neon free tier suspends when idle**, so the first request after a quiet period is slower.

---

## Disclaimer

RAILVYN is not affiliated with IRCTC, Indian Railways, or any railway operator. It is a
portfolio/educational system built to demonstrate journey-aware inventory, transactional
allocation and scoped operations. All names, schedules and availability are fabricated for
demonstration. Do not use it to plan or purchase real travel.

Built with Next.js, Drizzle ORM, Neon PostgreSQL and Better Auth.
