# RAILVYN — Agent Instructions

## Product definition
RAILVYN is a responsive, database-first **Railway Coach & Dynamic Seat Allocation System**. It lets passengers search scheduled train runs, view coach/seat layouts, request seats for a station-to-station journey, reserve or cancel bookings, and receive an app-generated booking reference. Railway operators manage train runs, coaches, occupancy, waitlists, and disruptions; admins control the network, permissions, and audit trail.

**Scope:** A fully working independent educational/demo booking system, **not** an IRCTC/Indian Railways service or official PNR generator. Show this distinction in the footer and booking confirmations. Do not claim access to actual train inventory, government APIs, or production payment gateways.

## North-star features
1. **Journey-aware seat inventory:** one physical seat can be sold again after a passenger alights, but never on an overlapping leg of the same train run.
2. **Interactive coach map:** berth types, deck/position, availability by requested source–destination, seating preferences, and a readable list alternative.
3. **Smart allocation:** honor class, availability, accessibility and group-adjacency preferences when feasible; clearly distinguish preferences from guarantees.
4. **Waitlist and reassignment:** FIFO-based queue within an explicit priority category; cancellations trigger a guarded promotion workflow with audit entries.
5. **Operations cockpit:** visual run occupancy by coach and segment, booking management, coach changes, incident/disruption flag, and searchable audit history.
6. **Analytics:** occupancy %, booked segments, seat reuse, cancellation rates, class utilization, and waitlist aging using genuine database calculations.

## Users and permissions
- **Passenger:** register/login; search; choose a journey; inspect seats; place timed holds; make demo bookings; cancel own bookings; view own tickets and profile.
- **Operator:** manage assigned train runs, inspect coach occupancy, resolve holds/waitlists, record disruptions, and view relevant passengers. No unrestricted access to unrelated runs.
- **Admin:** manage stations, routes, trains, coaches, schedules, users/roles, pricing rules, and system-wide reports/audits.
- All authorization **must** be verified on the server for every action and read; client-side route hiding is not authorization.

## Stack and infrastructure
- Next.js App Router + TypeScript (strict) + React; deploy on **Vercel** using Node.js runtime for database/auth routes.
- **Neon PostgreSQL**, **Drizzle ORM** + versioned Drizzle Kit SQL migrations. Use an appropriate Neon driver with transaction support for booking mutations; do not implement multi-statement locking with a stateless HTTP-only query path.
- **Better Auth** with Drizzle PostgreSQL adapter for credentials, sessions, verification, and role enforcement. Prefer supported stable compatible releases; verify APIs against installed versions.
- Tailwind CSS, shadcn/ui + Radix primitives, Lucide icons, Motion only for subtle animations.
- Zod + React Hook Form; TanStack Table for operator tables; Recharts for reports.
- Vitest for domain/unit and database integration tests; Playwright for critical end-to-end journeys; ESLint and TypeScript checks.
- Availability refresh: client polling/refetch on demand (for example 5–10 seconds), **always revalidate on the server at commit time**. Do not rely on long-running WebSocket servers inside Vercel functions.
- Use a demo-payment adapter initially. Do not store payment card details or make real-payment claims. A real payment provider is optional and requires server-side webhook verification.

## Required screens
**Public/auth:** landing, search/results, run details & stop timeline, interactive coach/seat selection, passenger information, checkout/hold, booking result, sign in, sign up, reset password.

**Passenger:** dashboard, my bookings, ticket/details, cancellation, profile/settings.

**Operator:** operations overview, assigned runs, coach occupancy console, booking/hold registry, waitlist queue, disruption log.

**Admin:** system dashboard, trains/routes/stations, schedules/runs, coach templates/composition, users/roles, pricing and policy rules, analytics, audit logs, settings.

Use consistent reusable layouts, route groups and page guards. Empty states, errors, loading states and mobile views are required, not optional.

## Data model — design before UI
Use normalized PostgreSQL entities approximately as follows (extend where necessary):
- `users`, `sessions`, `accounts`, `verifications` (auth-managed) and explicit `role_assignments`/operator scopes.
- `stations`, `routes`, `route_stops` (strict contiguous `stop_index`), `trains`, `train_runs` (service date and concrete departures/arrivals).
- `coach_templates`, `template_seats` (class, berth type, position, accessible flag), `run_coaches`, `run_seats` (physical instance of the seat on a specific run).
- `bookings`, `booking_passengers`, `booking_seats`, `seat_holds`, `seat_segment_claims`, `waitlist_entries`, `fares`, `payments_demo`, `disruptions`, `audit_logs`.

**Non-negotiable invariant:** A route with stops indexed 0..N has travel segments 0..N-1. A journey from stop `a` to `b` occupies half-open range `[a,b)` where `0 <= a < b <= N`. Claims are inserted for **every** segment in that range, with a DB-level `UNIQUE(run_seat_id, segment_index)` constraint. Active holds and confirmed bookings both own claims. Expired holds must release claims transactionally, and both expired and live holds must be checked under concurrency. Never consider overlapping seats available based only on cached UI state.

## Booking transaction and concurrency rules
1. Validate run, ordered stops, passenger count, fare, class, restrictions and actor on server.
2. In a PostgreSQL transaction: clean up stale claims for the run/seat being considered **under appropriate locking**, select eligible seats, atomically insert hold + one claim per occupied segment, and handle unique conflicts with bounded retry/alternative seat selection.
3. Hold expires after a short configurable TTL (default 5 minutes); checkout requires a still-valid hold. Confirm the booking and convert ownership/status in the **same transaction**, idempotently. A booking cannot exist as confirmed without its segment claims.
4. Cancellation transaction releases its claims, marks records cancelled, creates an audit event and schedules/attempts waitlist promotion. Repeat cancellation and payment callback must be idempotent.
5. Use a secured cleanup endpoint/worker for expired holds if available. **Do not depend on frequent Vercel Hobby cron:** the Hobby plan may only permit once-daily cron. Guarantee correctness with lazy expiry cleanup on allocation/confirmation; scheduled cleanup is an optional optimization.
6. Train runs with booked segments cannot silently delete/rearrange physical seats; use a controlled reassignment or block the edit.
7. Generate an **internal RAILVYN reference**, never represent it as official PNR.

## Engineering conduct
- Read `DESIGN.md` and `SKILL.md` before creating components, schemas or features. They are mandatory local project instructions.
- Keep domain logic in server-only `src/lib/domain/` services. UI must never directly write inventory claims.
- Use type-safe server actions or route handlers with Zod validation, auth, RBAC, and safe errors; use parameterized queries. Never ship secrets or privileged DB calls to the browser.
- Add database indexes/foreign keys/check constraints; create reproducible migrations and deterministic seed data (multi-stop journeys, 2+ coach classes, overlapping and nonoverlapping requests, waitlist examples).
- Create `.env.example`, setup instructions, seed scripts, and deployment instructions. Do not require real Neon credentials merely to render public pages, but data-dependent features must use real PostgreSQL when configured.
- Never fake successful bookings, analytics, database writes, authentication, or tested status. Demo payments must be unmistakably labelled.
- Continue working across implementation tasks rather than stopping at a static mockup. Test each completed flow.

## Definition of done
- Sign-up/sign-in and role-based access work.
- Trains/runs/routes/coaches persist in Neon and are manageable by scoped users.
- Passenger can search, see accurate per-segment availability, hold, confirm demo booking, view ticket, and cancel.
- Overlapping simultaneous booking attempts **cannot** produce double allocation; non-overlapping journeys may reuse a seat.
- Waitlist changes, expirations and cancellations behave correctly, including retries.
- Responsive UI matches `DESIGN.md`; accessibility, loading, error, and empty states are present.
- `lint`, `typecheck`, tests and production build pass; document any failures honestly.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
