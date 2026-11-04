---
name: railvyn-booking-engineering
description: Implement and review RAILVYN railway coach layouts, segment-aware seat allocation, reservation workflows, secured operator tools, and Neon PostgreSQL persistence.
---

# RAILVYN — Project Skill

## When to use
Apply this skill whenever implementing or modifying: train/route/run databases; coach maps; availability; seat allocation; holds and bookings; waitlists; fare calculation; cancellations; operator administration; analytics; or tests touching these systems. Also apply `DESIGN.md` to all interfaces.

## Method (mandatory)
1. **Map the journey.** Identify a specific `train_run_id`, boarding stop index `a`, alighting stop index `b`, seat class, passenger count and current actor. Reject invalid ranges, past runs, or insufficient permissions.
2. **Compute segment occupancy.** The journey uses `[a,b)`. An occupied seat is unavailable only where any target segment overlaps; if one passenger leaves at B, another may board at B.
3. **Enforce integrity in PostgreSQL.** Treat the unique `(run_seat_id, segment_index)` claim as the final source of truth. All claim insertion/deletion and booking state transitions must be transactional. Use a driver that supports interactive transactions and locks as required. Safely retry collisions; never silently oversell.
4. **Handle time and identity.** Store actual timestamps in UTC; display in the train/station timezone (default Asia/Kolkata for demo data). Use stable IDs and an app-generated reference separate from the internal booking ID.
5. **Respect lifecycle.** States: draft -> held -> confirmed / expired / cancelled; waitlisted -> offered / confirmed / expired. Define legal transitions, timeouts, promotion rules and idempotency keys. No orphan claims.
6. **Protect reads and writes.** Validate every mutation with Zod and server session + role + resource scope checks. Audit privileged actions and inventory transitions; sanitize passenger details.
7. **Test first-class edge cases.** Concurrent overlapping requests; adjacent nonoverlapping legs; expired hold racing confirmation; two tabs confirming once; operator coach removal with bookings; class change; cancellation-triggered promotion; no matching seat; missing data; unauthorized user.

## Core seat algorithm
For a request of `k` passengers on run `R`, from stop `a` to stop `b`:

```text
requestedSegments = [a, a+1, ..., b-1]
eligibleSeats = seats on R matching requested class/requirements
rank eligibleSeats by preference and available consecutive/group positions
in one transaction, for each proposed seat:
  release expired conflicting holds/claims safely
  insert active hold record and claim each requested segment
  rely on UNIQUE(run_seat_id, segment_index) to reject collisions
on failure: rollback that candidate and try another eligible seat
if k seats cannot be held together according to policy:
  roll back the group request; offer alternatives or waitlist
on demo checkout: validate hold TTL and idempotently confirm in transaction
```

Never implement `if available then INSERT booking` as two unprotected database operations. An optimistic UI can show stale inventory, but the server must always resolve collisions safely.

## Preferred feature modules
- `src/lib/domain/availability.ts`: segment-based search and class capacity.
- `src/lib/domain/allocation.ts`: seat ranking and transactional claims.
- `src/lib/domain/reservations.ts`: holds, confirmation, cancellation, reference generation.
- `src/lib/domain/waitlist.ts`: fair queue and controlled promotions.
- `src/lib/domain/fare.ts`: deterministic pricing in INR, no invented payment success.
- `src/lib/auth/` + `src/lib/permissions/`: authentication and scoped authorization.
- `src/db/`: schemas, queries, migrations, seed data; `tests/` for concurrency/invariants.

These paths are suggested conventions, not an excuse to duplicate code or add unnecessary layers.

## Output for every meaningful feature
- Working UI connected to a real server-side operation and database.
- Database migration, when the schema changes.
- Validated permissions, observable loading/error/success behavior.
- Automated tests, including a competing booking request where relevant.
- Short note in existing README about configuration or trade-offs.

## Quality gate
A feature is not finished if it only looks interactive, uses array-only/mock persistence, permits double allocation, hides failures, bypasses authorization, or violates `DESIGN.md`.
