import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type DbTransaction } from "@/db";
import {
  seatHolds,
  seatSegmentClaims,
  trainRuns,
  user,
  waitlistEntries,
  type TravelClass,
} from "@/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { writeAudit } from "./audit";
import {
  allocateHoldInTx,
  expireStaleHolds,
  loadRunForAllocation,
  lockRun,
} from "./allocation";
import { getPolicies } from "@/lib/settings";
import { generateIdempotencyKey } from "./reference";

export type JoinWaitlistInput = {
  userId: string;
  runId: string;
  fromStopIndex: number;
  toStopIndex: number;
  travelClass: TravelClass;
  passengerCount: number;
};

export async function joinWaitlist(input: JoinWaitlistInput) {
  const policies = await getPolicies();
  if (!policies.allowWaitlist) {
    throw new ValidationError("The waitlist is currently disabled for this deployment.");
  }
  if (
    input.passengerCount < 1 ||
    input.passengerCount > policies.maxSeatsPerBooking
  ) {
    throw new ValidationError(
      `Waitlist requests support 1 to ${policies.maxSeatsPerBooking} passengers.`,
    );
  }
  const db = getDb();
  const run = await loadRunForAllocation(db, input.runId);
  if (
    input.fromStopIndex < 0 ||
    input.toStopIndex > run.stopCount - 1 ||
    input.fromStopIndex >= input.toStopIndex
  ) {
    throw new ValidationError("Choose a valid boarding and alighting station.");
  }
  if (run.departureAt.getTime() <= Date.now()) {
    throw new ValidationError("That train has already departed.");
  }

  const classSeats = (await db.execute(sql`
    select count(*)::int as "count"
    from run_seats rs
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${input.runId} and rc.travel_class = ${input.travelClass}
  `)) as unknown as Array<{ count: number }>;
  if (!classSeats[0] || classSeats[0].count === 0) {
    throw new ValidationError("That class is not offered on this run.");
  }

  const [existing] = await db
    .select()
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.userId, input.userId),
        eq(waitlistEntries.runId, input.runId),
        eq(waitlistEntries.travelClass, input.travelClass),
        eq(waitlistEntries.fromStopIndex, input.fromStopIndex),
        eq(waitlistEntries.toStopIndex, input.toStopIndex),
        sql`${waitlistEntries.status} in ('waiting', 'offered')`,
      ),
    )
    .limit(1);
  if (existing) return { entry: existing, created: false };

  const [positionRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.runId, input.runId),
        eq(waitlistEntries.travelClass, input.travelClass),
        sql`${waitlistEntries.status} in ('waiting', 'offered')`,
      ),
    );

  const [entry] = await db
    .insert(waitlistEntries)
    .values({
      userId: input.userId,
      runId: input.runId,
      fromStopIndex: input.fromStopIndex,
      toStopIndex: input.toStopIndex,
      travelClass: input.travelClass,
      passengerCount: input.passengerCount,
      priority: 0,
      status: "waiting",
    })
    .returning();

  await writeAudit({
    actorUserId: input.userId,
    actorRole: "passenger",
    action: "waitlist.joined",
    entityType: "waitlist_entry",
    entityId: entry?.id ?? null,
    metadata: {
      runId: input.runId,
      travelClass: input.travelClass,
      passengerCount: input.passengerCount,
      queuePosition: (positionRow?.count ?? 0) + 1,
    },
  });

  return { entry: entry!, created: true, queuePosition: (positionRow?.count ?? 0) + 1 };
}

/**
 * FIFO promotion inside an explicit priority category. Each attempt runs in a
 * savepoint so a single conflicting entry cannot abort the caller (usually a
 * cancellation transaction). Promotion creates a short-lived hold that the
 * passenger must confirm, never a booking directly.
 */
export async function promoteWaitlist(
  tx: DbTransaction,
  input: {
    runId: string;
    travelClass: TravelClass;
    offerTtlSeconds: number;
    maxSeats: number;
    actorUserId?: string;
  },
): Promise<{ entryId: string; holdId: string } | null> {
  const candidates = await tx
    .select()
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.runId, input.runId),
        eq(waitlistEntries.travelClass, input.travelClass),
        eq(waitlistEntries.status, "waiting"),
      ),
    )
    .orderBy(desc(waitlistEntries.priority), asc(waitlistEntries.createdAt))
    .limit(20);

  for (const candidate of candidates) {
    try {
      let outcome: { holdId: string; entryId: string } | null = null;
      await tx.transaction(async (sp) => {
        const hold = await allocateHoldInTx(
          sp,
          {
            userId: candidate.userId,
            runId: candidate.runId,
            fromStopIndex: candidate.fromStopIndex,
            toStopIndex: candidate.toStopIndex,
            travelClass: candidate.travelClass,
            passengerCount: candidate.passengerCount,
            idempotencyKey: generateIdempotencyKey(`wl-${candidate.id}`),
            actorRole: "waitlist",
          },
          {
            ...(await getPolicies()),
            maxSeatsPerBooking: input.maxSeats,
          },
          {
            ttlSeconds: input.offerTtlSeconds,
            maxSeatsOverride: input.maxSeats,
            auditAction: "waitlist.offered",
            source: "waitlist",
          },
        );

        await sp
          .update(waitlistEntries)
          .set({
            status: "offered",
            offeredHoldId: hold.holdId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(waitlistEntries.id, candidate.id),
              eq(waitlistEntries.status, "waiting"),
            ),
          );

        await writeAudit(
          {
            actorUserId: input.actorUserId ?? null,
            actorRole: "system",
            action: "waitlist.offered",
            entityType: "waitlist_entry",
            entityId: candidate.id,
            metadata: {
              runId: candidate.runId,
              holdId: hold.holdId,
              expiresAt: hold.expiresAt.toISOString(),
              travelClass: candidate.travelClass,
            },
          },
          sp,
        );

        outcome = { holdId: hold.holdId, entryId: candidate.id };
      });
      if (outcome) return outcome;
    } catch (error) {
      // No seat for this entry's leg, or a claim race: try the next entry.
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[railvyn] waitlist candidate skipped",
          candidate.id,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
  return null;
}

export async function cancelWaitlistEntry(input: {
  entryId: string;
  actorUserId: string;
  staffOverride?: boolean;
}) {
  const db = getDb();
  const [entry] = await db
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, input.entryId))
    .limit(1);
  if (!entry) throw new NotFoundError("That waitlist entry could not be found.");
  if (!input.staffOverride && entry.userId !== input.actorUserId) {
    throw new ForbiddenError("You can only manage your own waitlist entry.");
  }

  return db.transaction(async (tx) => {
    await lockRun(tx, entry.runId);
    await expireStaleHolds(tx, entry.runId);

    const [current] = await tx
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, entry.id))
      .for("update")
      .limit(1);
    if (!current) throw new NotFoundError("That waitlist entry could not be found.");
    if (["cancelled", "confirmed", "expired"].includes(current.status)) {
      return { alreadyClosed: true };
    }

    if (current.offeredHoldId) {
      await tx
        .delete(seatSegmentClaims)
        .where(eq(seatSegmentClaims.holdId, current.offeredHoldId));
      await tx
        .update(seatHolds)
        .set({ status: "released" })
        .where(eq(seatHolds.id, current.offeredHoldId));
    }

    await tx
      .update(waitlistEntries)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(waitlistEntries.id, current.id));

    await writeAudit(
      {
        actorUserId: input.actorUserId,
        actorRole: input.staffOverride ? "operator" : "passenger",
        action: "waitlist.cancelled",
        entityType: "waitlist_entry",
        entityId: current.id,
        metadata: { runId: current.runId, offeredHoldId: current.offeredHoldId },
      },
      tx,
    );

    return { alreadyClosed: false };
  });
}

export async function listWaitlistForRun(runId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: waitlistEntries.id,
      status: waitlistEntries.status,
      priority: waitlistEntries.priority,
      passengerCount: waitlistEntries.passengerCount,
      travelClass: waitlistEntries.travelClass,
      fromStopIndex: waitlistEntries.fromStopIndex,
      toStopIndex: waitlistEntries.toStopIndex,
      createdAt: waitlistEntries.createdAt,
      updatedAt: waitlistEntries.updatedAt,
      offeredHoldId: waitlistEntries.offeredHoldId,
      userName: user.name,
      userEmail: user.email,
      fromCode: sql<string>`(select s.code from route_stops rs join stations s on s.id = rs.station_id where rs.route_id = (select rt.id from trains t join routes rt on rt.id = t.route_id join train_runs tr on tr.train_id = t.id where tr.id = ${runId}) and rs.stop_index = ${waitlistEntries.fromStopIndex})`,
      toCode: sql<string>`(select s.code from route_stops rs join stations s on s.id = rs.station_id where rs.route_id = (select rt.id from trains t join routes rt on rt.id = t.route_id join train_runs tr on tr.train_id = t.id where tr.id = ${runId}) and rs.stop_index = ${waitlistEntries.toStopIndex})`,
      offeredExpiresAt: seatHolds.expiresAt,
    })
    .from(waitlistEntries)
    .innerJoin(user, eq(waitlistEntries.userId, user.id))
    .leftJoin(seatHolds, eq(waitlistEntries.offeredHoldId, seatHolds.id))
    .where(eq(waitlistEntries.runId, runId))
    .orderBy(desc(waitlistEntries.priority), asc(waitlistEntries.createdAt));
  return rows;
}

export async function listWaitlistForUser(userId: string) {
  const db = getDb();
  return db
    .select({
      id: waitlistEntries.id,
      status: waitlistEntries.status,
      travelClass: waitlistEntries.travelClass,
      passengerCount: waitlistEntries.passengerCount,
      createdAt: waitlistEntries.createdAt,
      offeredHoldId: waitlistEntries.offeredHoldId,
      serviceDate: trainRuns.serviceDate,
      trainName: sql<string>`(select name from trains where id = ${trainRuns.trainId})`,
      fromCode: sql<string>`(select s.code from route_stops rs join stations s on s.id = rs.station_id join trains t on t.route_id = rs.route_id where t.id = ${trainRuns.trainId} and rs.stop_index = ${waitlistEntries.fromStopIndex})`,
      toCode: sql<string>`(select s.code from route_stops rs join stations s on s.id = rs.station_id join trains t on t.route_id = rs.route_id where t.id = ${trainRuns.trainId} and rs.stop_index = ${waitlistEntries.toStopIndex})`,
    })
    .from(waitlistEntries)
    .innerJoin(trainRuns, eq(waitlistEntries.runId, trainRuns.id))
    .where(eq(waitlistEntries.userId, userId))
    .orderBy(desc(waitlistEntries.createdAt));
}

/** Operator action: raise priority within the explicit app-defined category. */
export async function setWaitlistPriority(input: {
  entryId: string;
  priority: number;
  actorUserId: string;
}) {
  const [entry] = await getDb()
    .select({ id: waitlistEntries.id, runId: waitlistEntries.runId })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.id, input.entryId))
    .limit(1);
  if (!entry) throw new NotFoundError("That waitlist entry could not be found.");
  await getDb()
    .update(waitlistEntries)
    .set({ priority: input.priority, updatedAt: new Date() })
    .where(eq(waitlistEntries.id, entry.id));
  await writeAudit({
    actorUserId: input.actorUserId,
    actorRole: "operator",
    action: "waitlist.priority_changed",
    entityType: "waitlist_entry",
    entityId: entry.id,
    metadata: { priority: input.priority, runId: entry.runId },
  });
}

export async function waitlistAgingSummary() {
  const db = getDb();
  return (await db.execute(sql`
    select w.travel_class as "travelClass",
           count(*)::int as "waiting",
           coalesce(max(extract(epoch from (now() - w.created_at)) / 3600), 0)::numeric(10,1) as "oldestHours",
           coalesce(avg(extract(epoch from (now() - w.created_at)) / 3600), 0)::numeric(10,1) as "averageHours"
    from waitlist_entries w
    where w.status in ('waiting', 'offered')
    group by w.travel_class
    order by w.travel_class
  `)) as unknown as Array<{
    travelClass: TravelClass;
    waiting: number;
    oldestHours: string;
    averageHours: string;
  }>;
}

