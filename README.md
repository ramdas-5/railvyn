# RAILVYN

**Every journey. Precisely placed.**

RAILVYN is an independent, database-first railway coach and **journey-aware seat allocation** demonstration. A passenger searches dated train runs, sees seat availability for their exact station-to-station leg, places a short-lived hold, completes a demo checkout, and receives an internal RAILVYN booking reference. Operators manage their assigned runs; administrators manage the network, inventory templates, fares, roles, policy and the audit trail.

> **Not IRCTC or Indian Railways.** RAILVYN is an educational/demo system. It does not connect to government APIs or real railway inventory, does not issue official PNRs, and never processes real payments. All train names, stations and availability in the seed are demonstration data.

## Stack

- Next.js 16 App Router, React 19, TypeScript (strict)
- Neon PostgreSQL with Drizzle ORM and versioned Drizzle Kit migrations
- Better Auth (Drizzle PostgreSQL adapter) for credentials, sessions and server-verified roles
- Tailwind CSS 4, shadcn-style primitives on Radix, Lucide icons
- Zod + React Hook Form, TanStack Table, Recharts
- Vitest for unit and PostgreSQL integration tests; Playwright is configured for end-to-end tests
- Vercel deployment using the Node.js runtime for database and auth routes

## Quick start (local)

Requirements: Node.js >= 20.9 and pnpm (the repository pins `pnpm@12.16.1`).

```bash
pnpm install
cp .env.example .env.local
```

Set at least these values in `.env.local`:

```dotenv
# Local embedded PostgreSQL started by `pnpm db:local`
NEON_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/railvyn

# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then, in one terminal:

```bash
pnpm db:local
```

Leave that process running, and in another terminal:

```bash
pnpm db:setup   # apply migrations, then reset + seed demonstration data
pnpm dev
```

Open <http://localhost:3000>.

### Demo accounts

Every seeded account uses the same demo password:

```text
RailvynDemo#2026
```

| Account | Role |
| --- | --- |
| `passenger@railvyn.demo` | Passenger (Aarav Sharma) |
| `priya@railvyn.demo` | Passenger (Priya Nair) |
| `kabir@railvyn.demo` | Passenger (Kabir Rao) |
| `operator@railvyn.demo` | Operator, scoped to selected trains (Meera Iyer) |
| `operator2@railvyn.demo` | Operator, different scope (Rohan Das) |
| `admin@railvyn.demo` | Administrator (Dev Malhotra) |

`pnpm db:seed` resets demonstration data. Do not run it against a database whose data you need to keep.

## Using Neon PostgreSQL

1. Create a Neon project and copy the **pooled** connection string.
2. Put it in `NEON_DATABASE_URL` (the only database variable RAILVYN reads). Prepared statements are disabled for pooler compatibility.
3. Apply migrations and optionally seed:

```bash
pnpm db:migrate
pnpm db:seed        # demo data only
```

4. Set `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` to the deployment URL (for local development, `http://localhost:3000`).

### One-file SQL setup (Neon SQL Editor)

[`railvyn-neon-setup.sql`](railvyn-neon-setup.sql) in the repository root contains the complete schema (Part 1) followed by the deterministic demo seed (Part 2). Paste the whole file into the Neon SQL Editor and click **Run** (not *Explain*, which cannot execute a multi-statement script), then set `NEON_DATABASE_URL`. The file is re-runnable: Part 1 drops and recreates the `public` schema, so every table in that schema is deleted first — use a dedicated demo database. It is about 7.3 MiB; if the SQL editor rejects it, run `pnpm db:seed` (Part 2 only) or `psql "$NEON_DATABASE_URL" -f railvyn-neon-setup.sql`. Choose either this file or `pnpm db:migrate` — do not apply both to the same database. Regenerate it with `pnpm db:sql:bundle` after changing `db/fullschema.sql` or `db/seed.sql`.

Public pages can render without a database, but search, booking, operator and admin features require a configured, migrated database. They fail with an explicit error rather than faking data.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start Next.js development server |
| `pnpm build` / `pnpm start` | Production build / production server |
| `pnpm typecheck` | Strict TypeScript check |
| `pnpm lint` | ESLint 9 flat config (`eslint.config.mjs`) |
| `pnpm test` | Unit tests |
| `pnpm test:all` | Unit + PostgreSQL integration tests |
| `pnpm test:e2e` | Playwright runner (add specs under `tests/e2e` as journeys are automated) |
| `pnpm db:local` | Start the embedded local PostgreSQL cluster on port 5433 |
| `pnpm db:generate` | Generate a new Drizzle migration from the schema |
| `pnpm db:migrate` | Apply versioned migrations from `drizzle/` |
| `pnpm db:seed` | Reset and seed demonstration data |
| `pnpm db:sql:export` / `pnpm db:sql:verify` | Export and verify standalone SQL schema/seed files in `db/` |

## What works

**Passenger**

- Search by stations/date, inspect a run's stop timeline, class availability and fares for the selected leg.
- Open the interactive coach/berth map or the accessible list alternative, choose seats, place a timed hold.
- Enter traveller details, complete the unmistakably labelled demo checkout, view the internal ticket and cancel before departure.
- Join a waitlist when the requested class is full for the exact leg.
- Dashboard, bookings, profile and password change.

**Operator**

- Scoped overview and assigned-run list; runs outside an operator's train scopes are neither listed nor operable.
- Run console with coach × segment occupancy, live holds, booking registry, guarded seat reassignment, staff cancellation, waitlist queue and disruption log.
- Resolving the last open incident returns a flagged run to scheduled.

**Administrator**

- System dashboard backed by real aggregates.
- Network: stations, routes and strictly ordered contiguous stops.
- Trains, dated run generation, coach templates and per-run coaches.
- Users, operator/admin role grants, explicit train scopes and password resets.
- Segment fares by route, class and stop pair.
- Analytics: occupancy, booked segments, seat reuse, cancellation rate, class utilisation, waitlist/holds and disruption impact.
- Searchable audit log and booking-policy settings.

## Correctness model

- A route with stops `0..N` has travel segments `0..N-1`. A journey from `a` to `b` claims every segment in the half-open range `[a, b)`.
- `seat_segment_claims` has a unique index on `(run_seat_id, segment_index)`. That constraint — not the UI — is the source of truth preventing double allocation.
- Holds and confirmed bookings both own claims. Allocation selects eligible seats inside a PostgreSQL transaction, releases stale claims, and retries safely on unique conflicts.
- Confirmation transfers the same claims from hold to booking in one transaction and is idempotent. Cancellation releases claims, marks records cancelled, writes an audit event and attempts a guarded FIFO/priority waitlist promotion.
- Expired holds are cleaned lazily by allocation and confirmation. No frequent Vercel cron is required; correctness does not depend on a scheduler.
- Coaches with claims cannot be silently removed; the API blocks the edit.
- Every mutation validates input with Zod, resolves the session and role on the server, checks operator train scope, and records privileged actions in `audit_logs`.
- Admin pages guard before executing queries, because App Router layouts and pages render in parallel; the route-group layout additionally provides the admin chrome.

## Testing

The integration suite expects a migrated test database. `.env.test` overrides `.env.local` for tests; point `NEON_DATABASE_URL` there at a disposable PostgreSQL database (for local use, `railvyn_test` on port 5433). The global setup applies migrations automatically.

```bash
pnpm db:local      # if using the embedded cluster
pnpm test:all
```

Coverage includes overlapping versus adjacent non-overlapping legs, hold/confirm/cancel invariants, waitlist promotion, and server-side operator scope authorization.

## Deployment (Vercel)

1. Create the Neon project and run `pnpm db:migrate` against it (locally or in CI) before the first deployment.
2. Import the repository into Vercel; the Next.js preset is sufficient. Database and auth routes must use the Node.js runtime (the defaults for these route handlers).
3. Set `NEON_DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` in the Vercel project. Use the pooled Neon host.
4. Optionally run `pnpm db:seed` once against a demonstration database. Never seed a database with data you need to keep.
5. Do not rely on Vercel Hobby cron for hold expiry. Expiry is lazy and transactional; a scheduled cleanup job is an optional optimization only.

## Project layout

```text
src/app/(public)       Public search, run, coach map, checkout, result
src/app/(auth)         Sign in, sign up, password help
src/app/(passenger)    Dashboard, bookings, ticket, cancellation, profile
src/app/(operator)     Scoped operations cockpit and run console
src/app/(admin)        Network, trains, runs, coaches, users, pricing, analytics, audit, settings
src/app/api            Better Auth handler and availability endpoint
src/lib/domain         Server-only allocation, availability, reservations, waitlist, fare, analytics, audit
src/lib/queries        Read models for operator and admin screens
src/db                 Drizzle client and schema
drizzle/               Versioned SQL migrations
scripts/               Local database, migration, seed and SQL export utilities
tests/                 Vitest unit and PostgreSQL integration suites
```

## Known limitations

- No email delivery is configured. Password resets are performed by an administrator, which also signs out existing sessions.
- Payments are simulated. No card fields exist, and no real refund occurs.
- Booking references are internal RAILVYN references (`RVN-…`), never official PNRs.
- Automated Playwright journeys are not yet committed; the runner and configuration are present.
- ESLint currently reports warnings (no errors) for TanStack Table's React Compiler incompatibility notice and a few unused imports.
