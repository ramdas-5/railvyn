import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb, type DbExecutor, type DbTransaction } from "@/db";
import {
  holdSeats,
  runCoaches,
  runSeats,
  seatHolds,
  seatSegmentClaims,
  trainRuns,
  trains,
  waitlistEntries,
  type BerthType,
  type TravelClass,
} from "@/db/schema";
import {
  ConflictError,
  NoSeatsAvailableError,
  NotFoundError,
  ValidationError,
  isUniqueViolation,
} from "@/lib/errors";
import { getFarePaise } from "./fare";
import { writeAudit } from "./audit";
import { getPolicies, type Policies } from "@/lib/settings";
import { generateIdempotencyKey } from "./reference";
import { getRunDetails, type RunDetails } from "./availability";

export type SeatPreference = {
  berthType?: BerthType | "any";
  accessibleOnly?: boolean;
  preferAdjacent?: boolean;
};

export type CreateHoldInput = {
  userId: string;
  runId: string;
  fromStopIndex: number;
  toStopIndex: number;
  travelClass: TravelClass;
  passengerCount: number;
  selectedSeatIds?: string[];
  preferences?: SeatPreference;
  idempotencyKey?: string;
  actorRole?: string;
};

export type HoldSeatInfo = {
  runSeatId: string;
  coachCode: string;
  coachPosition: number;
  seatNumber: number;
  berthType: BerthType;
  isAccessible: boolean;
  label: string;
};

export type HoldOutcome = {
  holdId: string;
  expiresAt: Date;
  seats: HoldSeatInfo[];
  farePerPassengerPaise: number;
  totalFarePaise: number;
  travelClass: TravelClass;
  created: boolean;
};

export type RankableSeat = {
  id: string;
  coachId: string;
  coachCode: string;
  coachPosition: number;
  seatNumber: number;
  berthType: BerthType;
  rowIndex: number;
  positionInRow: number;
  isAccessible: boolean;
};

const MAX_ALLOCATION_ATTEMPTS = 3;

/**
 * Serializes inventory mutations per run inside the current transaction.
 * Transaction-scoped advisory locks are released automatically on commit or
 * rollback, and the unique claim index remains the final guard.
 */
export async function lockRun(tx: DbTransaction, runId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`railvyn:run:${runId}`})::bigint)`,
  );
}

/**
 * Releases claims for expired holds. Must run inside the same transaction that
 * makes the allocation decision so a stale hold can never win a race.
 */
export async function expireStaleHolds(
  tx: DbTransaction,
  runId?: string,
  now = new Date(),
): Promise<string[]> {
  const expired = await tx
    .select({ id: seatHolds.id })
    .from(seatHolds)
    .where(
      runId
        ? and(
            eq(seatHolds.status, "active"),
            lte(seatHolds.expiresAt, now),
            eq(seatHolds.runId, runId),
          )
        : and(eq(seatHolds.status, "active"), lte(seatHolds.expiresAt, now)),
    )
    .for("update", { skipLocked: true });

  if (expired.length === 0) return [];
  const ids = expired.map((row) => row.id);

  await tx.delete(seatSegmentClaims).where(inArray(seatSegmentClaims.holdId, ids));
  await tx.update(seatHolds).set({ status: "expired" }).where(inArray(seatHolds.id, ids));
  await tx
    .update(waitlistEntries)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        inArray(waitlistEntries.offeredHoldId, ids),
        eq(waitlistEntries.status, "offered"),
      ),
    );

  return ids;
}

/** Deterministic best-effort ranking: berth/accessibility preference, then adjacency. */
export function rankAndSelectSeats(
  seats: RankableSeat[],
  count: number,
  preferences: SeatPreference = {},
): RankableSeat[] {
  let pool = [...seats];
  if (preferences.accessibleOnly) {
    const accessible = pool.filter((seat) => seat.isAccessible);
    if (accessible.length >= count) pool = accessible;
  }
  if (pool.length < count) return [];

  const preferredBerth =
    preferences.berthType && preferences.berthType !== "any"
      ? preferences.berthType
      : null;

  const chosen: RankableSeat[] = [];
  const remaining = new Set(pool.map((seat) => seat.id));
  const byId = new Map(pool.map((seat) => [seat.id, seat]));

  const score = (seat: RankableSeat): number => {
    let value = 0;
    if (preferredBerth && seat.berthType !== preferredBerth) value += 100;
    if (!seat.isAccessible) value += 0.5;
    if (chosen.length > 0) {
      const first = chosen[0]!;
      if (preferences.preferAdjacent !== false) {
        if (seat.coachId !== first.coachId) value += 40;
        const rowDistance = Math.min(
          ...chosen.map((picked) => Math.abs(picked.rowIndex - seat.rowIndex)),
        );
        value += rowDistance * 3;
        const positionDistance = Math.min(
          ...chosen.map((picked) => Math.abs(picked.positionInRow - seat.positionInRow)),
        );
        value += positionDistance;
      }
    }
    // Stable tie-breakers so allocation is reproducible.
    value += seat.coachPosition * 0.01;
    value += seat.seatNumber * 0.001;
    return value;
  };

  for (let i = 0; i < count; i += 1) {
    const candidates = [...remaining]
      .map((id) => byId.get(id)!)
      .sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
    const next = candidates[0];
    if (!next) return [];
    chosen.push(next);
    remaining.delete(next.id);
  }

  return chosen;
}

export async function getAvailableSeats(
  tx: DbExecutor,
  runId: string,
  travelClass: TravelClass,
  fromStopIndex: number,
  toStopIndex: number,
): Promise<RankableSeat[]> {
  const seats = await tx
    .select({
      id: runSeats.id,
      coachId: runCoaches.id,
      coachCode: runCoaches.coachCode,
      coachPosition: runCoaches.position,
      seatNumber: runSeats.seatNumber,
      berthType: runSeats.berthType,
      rowIndex: runSeats.rowIndex,
      positionInRow: runSeats.positionInRow,
      isAccessible: runSeats.isAccessible,
    })
    .from(runSeats)
    .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
    .where(
      and(
        eq(runCoaches.runId, runId),
        eq(runCoaches.travelClass, travelClass),
        sql`not exists (
          select 1 from seat_segment_claims c
          left join seat_holds h on h.id = c.hold_id
          where c.run_seat_id = ${runSeats.id}
            and c.segment_index >= ${fromStopIndex}
            and c.segment_index < ${toStopIndex}
            and (c.booking_id is not null
                 or (c.hold_id is not null and h.status = 'active' and h.expires_at > now()))
        )`,
      ),
    )
    .orderBy(asc(runCoaches.position), asc(runSeats.seatNumber));
  return seats;
}

type RunForAllocation = {
  id: string;
  status: "scheduled" | "disrupted" | "cancelled" | "completed";
  departureAt: Date;
  routeId: string;
  stopCount: number;
};

export async function loadRunForAllocation(
  tx: DbExecutor,
  runId: string,
): Promise<RunForAllocation> {
  const [row] = await tx
    .select({
      id: trainRuns.id,
      status: trainRuns.status,
      departureAt: trainRuns.departureAt,
      routeId: trains.routeId,
      stopCount: sql<number>`(select count(*)::int from route_stops where route_id = ${trains.routeId})`,
    })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .where(eq(trainRuns.id, runId))
    .limit(1);
  if (!row) throw new NotFoundError("That train run could not be found.");
  return row;
}

export function assertBookableWindow(
  run: RunForAllocation,
  fromStopIndex: number,
  toStopIndex: number,
  now = new Date(),
): void {
  if (run.status === "cancelled" || run.status === "completed") {
    throw new ValidationError("That train run is not open for booking.");
  }
  if (!Number.isInteger(fromStopIndex) || !Number.isInteger(toStopIndex)) {
    throw new ValidationError("Choose a valid boarding and alighting station.");
  }
  if (fromStopIndex < 0 || toStopIndex > run.stopCount - 1 || fromStopIndex >= toStopIndex) {
    throw new ValidationError("Choose a valid boarding and alighting station.");
  }
  if (run.departureAt.getTime() <= now.getTime()) {
    throw new ValidationError("That train has already departed.");
  }
}

type AllocateOptions = {
  ttlSeconds: number;
  maxSeatsOverride?: number;
  auditAction?: string;
  source?: string;
};

/**
 * Inserts a hold, its seats and every segment claim inside the caller's
 * transaction. All-or-nothing: any conflict aborts the whole hold and the
 * caller either retries with fresh availability or reports unavailability.
 */
export async function allocateHoldInTx(
  tx: DbTransaction,
  input: CreateHoldInput,
  policies: Policies,
  options: AllocateOptions,
): Promise<HoldOutcome> {
  const now = new Date();
  const run = await loadRunForAllocation(tx, input.runId);
  assertBookableWindow(run, input.fromStopIndex, input.toStopIndex, now);

  const maxSeats = options.maxSeatsOverride ?? policies.maxSeatsPerBooking;
  if (
    !Number.isInteger(input.passengerCount) ||
    input.passengerCount < 1 ||
    input.passengerCount > maxSeats
  ) {
    throw new ValidationError(
      `Choose between 1 and ${maxSeats} seats for a single booking.`,
    );
  }

  const farePerPassengerPaise = await getFarePaise(
    run.routeId,
    input.travelClass,
    input.fromStopIndex,
    input.toStopIndex,
    tx,
  );

  const available = await getAvailableSeats(
    tx,
    input.runId,
    input.travelClass,
    input.fromStopIndex,
    input.toStopIndex,
  );

  let selected: RankableSeat[];
  if (input.selectedSeatIds && input.selectedSeatIds.length > 0) {
    const unique = [...new Set(input.selectedSeatIds)];
    if (unique.length !== input.passengerCount) {
      throw new ValidationError(
        `Select exactly ${input.passengerCount} seat${input.passengerCount === 1 ? "" : "s"}.`,
      );
    }
    const availableById = new Map(available.map((seat) => [seat.id, seat]));
    selected = unique.map((id) => {
      const seat = availableById.get(id);
      if (!seat) {
        throw new NoSeatsAvailableError(
          "One of those seats was just taken. Review the coach map and choose again.",
        );
      }
      return seat;
    });
  } else {
    selected = rankAndSelectSeats(available, input.passengerCount, input.preferences);
    if (selected.length < input.passengerCount) {
      throw new NoSeatsAvailableError(
        `Only ${available.length} seat${available.length === 1 ? "" : "s"} remain in this class for your journey. Join the waitlist to keep your place.`,
      );
    }
  }

  const expiresAt = new Date(now.getTime() + options.ttlSeconds * 1000);
  const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey("hold");

  const [hold] = await tx
    .insert(seatHolds)
    .values({
      userId: input.userId,
      runId: input.runId,
      fromStopIndex: input.fromStopIndex,
      toStopIndex: input.toStopIndex,
      travelClass: input.travelClass,
      passengerCount: input.passengerCount,
      expiresAt,
      idempotencyKey,
      status: "active",
    })
    .returning({ id: seatHolds.id, expiresAt: seatHolds.expiresAt });

  if (!hold) throw new ConflictError("The seat hold could not be created. Please retry.");

  await tx.insert(holdSeats).values(
    selected.map((seat) => ({ holdId: hold.id, runSeatId: seat.id })),
  );

  const segmentIndexes = Array.from(
    { length: input.toStopIndex - input.fromStopIndex },
    (_, index) => input.fromStopIndex + index,
  );
  await tx.insert(seatSegmentClaims).values(
    selected.flatMap((seat) =>
      segmentIndexes.map((segmentIndex) => ({
        runSeatId: seat.id,
        segmentIndex,
        holdId: hold.id,
      })),
    ),
  );

  await writeAudit(
    {
      actorUserId: input.userId,
      actorRole: input.actorRole ?? "passenger",
      action: options.auditAction ?? "hold.created",
      entityType: "seat_hold",
      entityId: hold.id,
      metadata: {
        runId: input.runId,
        travelClass: input.travelClass,
        fromStopIndex: input.fromStopIndex,
        toStopIndex: input.toStopIndex,
        seats: selected.map((seat) => `${seat.coachCode}-${seat.seatNumber}`),
        source: options.source ?? "passenger",
      },
    },
    tx,
  );

  return {
    holdId: hold.id,
    expiresAt: hold.expiresAt,
    seats: selected.map((seat) => ({
      runSeatId: seat.id,
      coachCode: seat.coachCode,
      coachPosition: seat.coachPosition,
      seatNumber: seat.seatNumber,
      berthType: seat.berthType,
      isAccessible: seat.isAccessible,
      label: `${seat.coachCode} · ${seat.seatNumber}`,
    })),
    farePerPassengerPaise,
    totalFarePaise: farePerPassengerPaise * input.passengerCount,
    travelClass: input.travelClass,
    created: true,
  };
}

async function loadHoldOutcome(holdId: string, executor?: DbExecutor): Promise<HoldOutcome> {
  const db = executor ?? getDb();
  const [hold] = await db
    .select({
      id: seatHolds.id,
      travelClass: seatHolds.travelClass,
      passengerCount: seatHolds.passengerCount,
      expiresAt: seatHolds.expiresAt,
      fromStopIndex: seatHolds.fromStopIndex,
      toStopIndex: seatHolds.toStopIndex,
      runId: seatHolds.runId,
    })
    .from(seatHolds)
    .where(eq(seatHolds.id, holdId))
    .limit(1);
  if (!hold) throw new NotFoundError("That seat hold no longer exists.");

  const seats = await db
    .select({
      runSeatId: runSeats.id,
      coachCode: runCoaches.coachCode,
      coachPosition: runCoaches.position,
      seatNumber: runSeats.seatNumber,
      berthType: runSeats.berthType,
      isAccessible: runSeats.isAccessible,
    })
    .from(holdSeats)
    .innerJoin(runSeats, eq(holdSeats.runSeatId, runSeats.id))
    .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
    .where(eq(holdSeats.holdId, holdId))
    .orderBy(runCoaches.position, runSeats.seatNumber);

  const run = await loadRunForAllocation(db, hold.runId);
  const farePerPassengerPaise = await getFarePaise(
    run.routeId,
    hold.travelClass,
    hold.fromStopIndex,
    hold.toStopIndex,
    db,
  );

  return {
    holdId: hold.id,
    expiresAt: hold.expiresAt,
    seats: seats.map((seat) => ({
      ...seat,
      label: `${seat.coachCode} · ${seat.seatNumber}`,
    })),
    farePerPassengerPaise,
    totalFarePaise: farePerPassengerPaise * hold.passengerCount,
    travelClass: hold.travelClass,
    created: false,
  };
}

/** Public entry point: transaction, locking, lazy expiry and bounded retry. */
export async function createHold(input: CreateHoldInput): Promise<HoldOutcome> {
  const db = getDb();
  const policies = await getPolicies();
  const idempotencyKey = input.idempotencyKey ?? generateIdempotencyKey("hold");
  const normalized: CreateHoldInput = { ...input, idempotencyKey };

  const [existing] = await db
    .select({ id: seatHolds.id, userId: seatHolds.userId })
    .from(seatHolds)
    .where(eq(seatHolds.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) {
    if (existing.userId !== input.userId) {
      throw new ConflictError("That request key is already in use.");
    }
    return loadHoldOutcome(existing.id, db);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        await lockRun(tx, input.runId);
        await expireStaleHolds(tx, input.runId);
        return allocateHoldInTx(tx, normalized, policies, {
          ttlSeconds: policies.holdTtlSeconds,
        });
      });
    } catch (error) {
      lastError = error;
      if (error instanceof NoSeatsAvailableError) throw error;
      if (error instanceof ValidationError) throw error;
      if (error instanceof NotFoundError) throw error;
      if (isUniqueViolation(error)) {
        const [again] = await db
          .select({ id: seatHolds.id })
          .from(seatHolds)
          .where(eq(seatHolds.idempotencyKey, idempotencyKey))
          .limit(1);
        if (again) return loadHoldOutcome(again.id, db);
        continue;
      }
      throw error;
    }
  }

  console.error("[railvyn] allocation retries exhausted", lastError);
  throw new ConflictError(
    "Seat availability changed while we were holding your seats. Please review the coach map and try again.",
  );
}

/** Explicitly abandons an active hold, releasing its claims transactionally. */
export async function releaseHold(input: {
  holdId: string;
  userId: string;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [hold] = await tx
      .select({ id: seatHolds.id, runId: seatHolds.runId, userId: seatHolds.userId, status: seatHolds.status })
      .from(seatHolds)
      .where(eq(seatHolds.id, input.holdId))
      .limit(1);
    if (!hold) return;
    if (hold.userId !== input.userId) throw new NotFoundError("That hold was not found.");
    if (hold.status !== "active") return;
    await lockRun(tx, hold.runId);
    await tx.delete(seatSegmentClaims).where(eq(seatSegmentClaims.holdId, hold.id));
    await tx.update(seatHolds).set({ status: "released" }).where(eq(seatHolds.id, hold.id));
    await writeAudit(
      {
        actorUserId: input.userId,
        actorRole: "passenger",
        action: "hold.released",
        entityType: "seat_hold",
        entityId: hold.id,
        metadata: { runId: hold.runId },
      },
      tx,
    );
  });
}

export type HoldDetail = {
  hold: typeof seatHolds.$inferSelect;
  outcome: HoldOutcome;
  details: RunDetails;
};

export async function getHoldDetail(holdId: string): Promise<HoldDetail> {
  const db = getDb();
  const [hold] = await db.select().from(seatHolds).where(eq(seatHolds.id, holdId)).limit(1);
  if (!hold) throw new NotFoundError("That seat hold no longer exists.");
  const outcome = await loadHoldOutcome(hold.id, db);
  const details = await getRunDetails(hold.runId, db);
  return { hold, outcome, details };
}

/** Returns claims for a hold; used by confirmation to verify totals. */
export async function countHoldClaims(
  tx: DbExecutor,
  holdId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(seatSegmentClaims)
    .where(eq(seatSegmentClaims.holdId, holdId));
  return row?.count ?? 0;
}
