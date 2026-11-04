import { and, eq, sql } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db";
import {
  bookingPassengers,
  bookingSeats,
  bookings,
  holdSeats,
  paymentsDemo,
  routeStops,
  routes,
  runCoaches,
  runSeats,
  seatHolds,
  seatSegmentClaims,
  stations,
  trainRuns,
  trains,
  waitlistEntries,
  type TravelClass,
} from "@/db/schema";
import {
  ConflictError,
  ForbiddenError,
  HoldExpiredError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { writeAudit } from "./audit";
import { getFarePaise } from "./fare";
import { generateBookingReference, generateIdempotencyKey } from "./reference";
import {
  countHoldClaims,
  expireStaleHolds,
  loadRunForAllocation,
  lockRun,
} from "./allocation";
import { getPolicies } from "@/lib/settings";
import { promoteWaitlist } from "./waitlist";

export type PassengerInput = {
  fullName: string;
  age: number;
  gender: "female" | "male" | "other";
};

export type ConfirmHoldInput = {
  userId: string;
  actorRole?: string;
  holdId: string;
  passengers: PassengerInput[];
  contactEmail: string;
  contactPhone?: string;
  idempotencyKey?: string;
};

export type ConfirmHoldResult = {
  bookingId: string;
  reference: string;
  totalFarePaise: number;
  alreadyConfirmed: boolean;
};

function validatePassengers(passengers: PassengerInput[], expected: number) {
  if (passengers.length !== expected) {
    throw new ValidationError(`Enter details for exactly ${expected} passenger(s).`);
  }
  for (const passenger of passengers) {
    if (!passenger.fullName || passenger.fullName.trim().length < 2) {
      throw new ValidationError("Enter each passenger's full name.");
    }
    if (
      !Number.isInteger(passenger.age) ||
      passenger.age < 0 ||
      passenger.age > 120
    ) {
      throw new ValidationError("Enter a valid age between 0 and 120.");
    }
    if (!["female", "male", "other"].includes(passenger.gender)) {
      throw new ValidationError("Select a gender for every passenger.");
    }
  }
}

/**
 * Converts an active hold into a confirmed booking, payment record and owned
 * segment claims in a single transaction. Repeated calls are idempotent and
 * never create a second booking or payment.
 */
export async function confirmHold(
  input: ConfirmHoldInput,
): Promise<ConfirmHoldResult> {
  const db = getDb();
  const [holdInfo] = await db
    .select({
      runId: seatHolds.runId,
      userId: seatHolds.userId,
      passengerCount: seatHolds.passengerCount,
      status: seatHolds.status,
    })
    .from(seatHolds)
    .where(eq(seatHolds.id, input.holdId))
    .limit(1);

  if (!holdInfo) throw new NotFoundError("That seat hold no longer exists.");
  if (holdInfo.userId !== input.userId) {
    throw new ForbiddenError("That seat hold belongs to another passenger.");
  }

  if (input.idempotencyKey) {
    const [existing] = await db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        totalFarePaise: bookings.totalFarePaise,
        userId: bookings.userId,
      })
      .from(bookings)
      .where(eq(bookings.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) {
      if (existing.userId !== input.userId) throw new ConflictError();
      return {
        bookingId: existing.id,
        reference: existing.reference,
        totalFarePaise: existing.totalFarePaise,
        alreadyConfirmed: true,
      };
    }
  }

  validatePassengers(input.passengers, holdInfo.passengerCount);

  return db.transaction(async (tx) => {
    await lockRun(tx, holdInfo.runId);
    await expireStaleHolds(tx, holdInfo.runId);

    const [hold] = await tx
      .select()
      .from(seatHolds)
      .where(eq(seatHolds.id, input.holdId))
      .for("update")
      .limit(1);

    if (!hold) throw new NotFoundError("That seat hold no longer exists.");
    if (hold.userId !== input.userId) {
      throw new ForbiddenError("That seat hold belongs to another passenger.");
    }

    if (hold.status === "converted" && hold.convertedBookingId) {
      const [booking] = await tx
        .select({
          id: bookings.id,
          reference: bookings.reference,
          totalFarePaise: bookings.totalFarePaise,
        })
        .from(bookings)
        .where(eq(bookings.id, hold.convertedBookingId))
        .limit(1);
      if (booking) {
        return {
          bookingId: booking.id,
          reference: booking.reference,
          totalFarePaise: booking.totalFarePaise,
          alreadyConfirmed: true,
        };
      }
    }

    if (hold.status !== "active") {
      throw new HoldExpiredError(
        "This hold is no longer active. Select seats again to continue.",
      );
    }

    if (hold.expiresAt.getTime() <= Date.now()) {
      await tx.delete(seatSegmentClaims).where(eq(seatSegmentClaims.holdId, hold.id));
      await tx.update(seatHolds).set({ status: "expired" }).where(eq(seatHolds.id, hold.id));
      await tx
        .update(waitlistEntries)
        .set({ status: "expired", updatedAt: new Date() })
        .where(
          and(
            eq(waitlistEntries.offeredHoldId, hold.id),
            eq(waitlistEntries.status, "offered"),
          ),
        );
      throw new HoldExpiredError();
    }

    const seatRows = await tx
      .select({
        runSeatId: runSeats.id,
        coachCode: runCoaches.coachCode,
        seatNumber: runSeats.seatNumber,
        berthType: runSeats.berthType,
      })
      .from(holdSeats)
      .innerJoin(runSeats, eq(holdSeats.runSeatId, runSeats.id))
      .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
      .where(eq(holdSeats.holdId, hold.id))
      .orderBy(runCoaches.position, runSeats.seatNumber);

    if (seatRows.length !== hold.passengerCount) {
      throw new ConflictError("This hold's seat allocation is incomplete. Please start again.");
    }

    const expectedSegments = hold.toStopIndex - hold.fromStopIndex;
    const claimCount = await countHoldClaims(tx, hold.id);
    if (claimCount !== seatRows.length * expectedSegments) {
      throw new ConflictError("This hold's segment claims are incomplete. Please start again.");
    }

    const run = await loadRunForAllocation(tx, hold.runId);
    const farePerPassengerPaise = await getFarePaise(
      run.routeId,
      hold.travelClass,
      hold.fromStopIndex,
      hold.toStopIndex,
      tx,
    );
    const totalFarePaise = farePerPassengerPaise * hold.passengerCount;

    const [booking] = await tx
      .insert(bookings)
      .values({
        reference: generateBookingReference(),
        userId: hold.userId,
        runId: hold.runId,
        fromStopIndex: hold.fromStopIndex,
        toStopIndex: hold.toStopIndex,
        travelClass: hold.travelClass,
        passengerCount: hold.passengerCount,
        totalFarePaise,
        status: "confirmed",
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone ?? null,
        idempotencyKey: input.idempotencyKey ?? generateIdempotencyKey("confirm"),
      })
      .returning({
        id: bookings.id,
        reference: bookings.reference,
        totalFarePaise: bookings.totalFarePaise,
      });
    if (!booking) throw new ConflictError("Could not allocate a booking reference. Retry.");

    const passengerRows = await tx
      .insert(bookingPassengers)
      .values(
        input.passengers.map((passenger, index) => ({
          bookingId: booking.id,
          fullName: passenger.fullName.trim(),
          age: passenger.age,
          gender: passenger.gender,
          position: index,
        })),
      )
      .returning({ id: bookingPassengers.id });

    await tx.insert(bookingSeats).values(
      seatRows.map((seat, index) => ({
        bookingId: booking.id,
        runSeatId: seat.runSeatId,
        passengerId: passengerRows[index]!.id,
        farePaise: farePerPassengerPaise,
      })),
    );

    const owned = await tx
      .update(seatSegmentClaims)
      .set({ bookingId: booking.id, holdId: null })
      .where(eq(seatSegmentClaims.holdId, hold.id))
      .returning({ id: seatSegmentClaims.id });

    if (owned.length !== claimCount) {
      throw new ConflictError("Segment ownership changed during confirmation.");
    }

    await tx
      .update(seatHolds)
      .set({ status: "converted", convertedBookingId: booking.id })
      .where(eq(seatHolds.id, hold.id));

    await tx.insert(paymentsDemo).values({
      bookingId: booking.id,
      amountPaise: totalFarePaise,
      status: "succeeded",
      method: "demo_card",
      idempotencyKey: `demo_payment_${booking.id}`,
    });

    await tx
      .update(waitlistEntries)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(
        and(
          eq(waitlistEntries.offeredHoldId, hold.id),
          eq(waitlistEntries.status, "offered"),
        ),
      );

    await writeAudit(
      {
        actorUserId: input.userId,
        actorRole: input.actorRole ?? "passenger",
        action: "booking.confirmed",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          reference: booking.reference,
          runId: hold.runId,
          travelClass: hold.travelClass,
          seats: seatRows.map((seat) => `${seat.coachCode}-${seat.seatNumber}`),
          totalFarePaise,
          payment: "demo",
        },
      },
      tx,
    );

    return {
      bookingId: booking.id,
      reference: booking.reference,
      totalFarePaise,
      alreadyConfirmed: false,
    };
  });
}

export type CancelBookingInput = {
  bookingId: string;
  actorUserId: string;
  actorRole: string;
  reason?: string;
  staffOverride?: boolean;
};

export type CancelBookingResult = {
  reference: string;
  alreadyCancelled: boolean;
  promotedEntryId: string | null;
};

/**
 * Releases claims, refunds the demo payment, writes an audit event and attempts
 * a guarded waitlist promotion. Repeating the cancellation is a no-op.
 */
export async function cancelBooking(
  input: CancelBookingInput,
): Promise<CancelBookingResult> {
  const db = getDb();
  const [summary] = await db
    .select({ runId: bookings.runId, userId: bookings.userId })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!summary) throw new NotFoundError("That booking could not be found.");
  if (!input.staffOverride && summary.userId !== input.actorUserId) {
    throw new ForbiddenError("You can only cancel your own bookings.");
  }

  const policies = await getPolicies();

  return db.transaction(async (tx) => {
    await lockRun(tx, summary.runId);
    await expireStaleHolds(tx, summary.runId);

    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .for("update")
      .limit(1);
    if (!booking) throw new NotFoundError("That booking could not be found.");
    if (!input.staffOverride && booking.userId !== input.actorUserId) {
      throw new ForbiddenError("You can only cancel your own bookings.");
    }
    if (booking.status === "cancelled") {
      return {
        reference: booking.reference,
        alreadyCancelled: true,
        promotedEntryId: null,
      };
    }

    await tx
      .delete(seatSegmentClaims)
      .where(eq(seatSegmentClaims.bookingId, booking.id));

    await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? null,
      })
      .where(eq(bookings.id, booking.id));

    await tx
      .update(paymentsDemo)
      .set({ status: "refunded" })
      .where(eq(paymentsDemo.bookingId, booking.id));

    await writeAudit(
      {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "booking.cancelled",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          reference: booking.reference,
          runId: booking.runId,
          travelClass: booking.travelClass,
          reason: input.reason ?? null,
          staffOverride: Boolean(input.staffOverride),
        },
      },
      tx,
    );

    // Promotion is best-effort and isolated in a savepoint: a failure here must
    // never undo a valid cancellation.
    let promotedEntryId: string | null = null;
    try {
      await tx.transaction(async (sp) => {
        const promoted = await promoteWaitlist(sp, {
          runId: booking.runId,
          travelClass: booking.travelClass as TravelClass,
          offerTtlSeconds: policies.waitlistOfferTtlSeconds,
          maxSeats: policies.maxSeatsPerBooking,
          actorUserId: input.actorUserId,
        });
        promotedEntryId = promoted?.entryId ?? null;
      });
    } catch (error) {
      console.error("[railvyn] waitlist promotion attempt failed", error);
    }

    return {
      reference: booking.reference,
      alreadyCancelled: false,
      promotedEntryId,
    };
  });
}

export type BookingDetail = Awaited<ReturnType<typeof getBookingDetail>>;

export async function getBookingDetail(
  bookingId: string,
  executor?: DbExecutor,
) {
  const db = executor ?? getDb();
  const [row] = await db
    .select({
      booking: bookings,
      run: {
        id: trainRuns.id,
        serviceDate: trainRuns.serviceDate,
        departureAt: trainRuns.departureAt,
        arrivalAt: trainRuns.arrivalAt,
        status: trainRuns.status,
        notes: trainRuns.notes,
      },
      train: { id: trains.id, code: trains.code, name: trains.name },
      route: { id: routes.id, name: routes.name, code: routes.code },
    })
    .from(bookings)
    .innerJoin(trainRuns, eq(bookings.runId, trainRuns.id))
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .innerJoin(routes, eq(trains.routeId, routes.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) throw new NotFoundError("That booking could not be found.");

  const stops = await db
    .select({
      stopIndex: routeStops.stopIndex,
      code: stations.code,
      name: stations.name,
      offsetMinutes: routeStops.scheduledOffsetMinutes,
      distanceKm: routeStops.distanceKm,
    })
    .from(routeStops)
    .innerJoin(stations, eq(routeStops.stationId, stations.id))
    .where(eq(routeStops.routeId, row.route.id))
    .orderBy(routeStops.stopIndex);

  const seats = await db
    .select({
      bookingSeatId: bookingSeats.id,
      farePaise: bookingSeats.farePaise,
      passengerId: bookingPassengers.id,
      fullName: bookingPassengers.fullName,
      age: bookingPassengers.age,
      gender: bookingPassengers.gender,
      position: bookingPassengers.position,
      seatNumber: runSeats.seatNumber,
      berthType: runSeats.berthType,
      isAccessible: runSeats.isAccessible,
      coachCode: runCoaches.coachCode,
      coachPosition: runCoaches.position,
    })
    .from(bookingSeats)
    .innerJoin(bookingPassengers, eq(bookingSeats.passengerId, bookingPassengers.id))
    .innerJoin(runSeats, eq(bookingSeats.runSeatId, runSeats.id))
    .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
    .where(eq(bookingSeats.bookingId, bookingId))
    .orderBy(runCoaches.position, runSeats.seatNumber);

  const [payment] = await db
    .select()
    .from(paymentsDemo)
    .where(eq(paymentsDemo.bookingId, bookingId))
    .limit(1);

  const fromStop = stops.find((stop) => stop.stopIndex === row.booking.fromStopIndex);
  const toStop = stops.find((stop) => stop.stopIndex === row.booking.toStopIndex);

  return {
    ...row,
    stops,
    fromStop,
    toStop,
    seats,
    payment: payment ?? null,
    durationMinutes: (toStop?.offsetMinutes ?? 0) - (fromStop?.offsetMinutes ?? 0),
  };
}

export type BookingSummary = {
  id: string;
  reference: string;
  status: "confirmed" | "cancelled";
  serviceDate: string;
  departureAt: Date;
  trainCode: string;
  trainName: string;
  travelClass: TravelClass;
  totalFarePaise: number;
  passengerCount: number;
  createdAt: Date;
  cancelledAt: Date | null;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  seatLabels: string;
  seatCount: number;
};

export async function listUserBookings(userId: string): Promise<BookingSummary[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    select b.id,
           b.reference,
           b.status,
           b.service_date as "serviceDate",
           b.departure_at as "departureAt",
           b.train_code as "trainCode",
           b.train_name as "trainName",
           b.travel_class as "travelClass",
           b.total_fare_paise as "totalFarePaise",
           b.passenger_count as "passengerCount",
           b.created_at as "createdAt",
           b.cancelled_at as "cancelledAt",
           b.from_code as "fromCode",
           b.to_code as "toCode",
           b.from_name as "fromName",
           b.to_name as "toName",
           coalesce(b.seat_labels, '') as "seatLabels",
           coalesce(b.seat_count, 0)::int as "seatCount"
    from (
      select bk.id,
             bk.reference,
             bk.status,
             r.service_date,
             r.departure_at,
             t.code as train_code,
             t.name as train_name,
             bk.travel_class,
             bk.total_fare_paise,
             bk.passenger_count,
             bk.created_at,
             bk.cancelled_at,
             fs.code as from_code,
             ts.code as to_code,
             fs.name as from_name,
             ts.name as to_name,
             (select string_agg(rc.coach_code || ' · ' || rs.seat_number, ', ' order by rc.position, rs.seat_number)
                from booking_seats bs
                join run_seats rs on rs.id = bs.run_seat_id
                join run_coaches rc on rc.id = rs.run_coach_id
               where bs.booking_id = bk.id) as seat_labels,
             (select count(*) from booking_seats bs where bs.booking_id = bk.id) as seat_count
        from bookings bk
        join train_runs r on r.id = bk.run_id
        join trains t on t.id = r.train_id
        join routes rt on rt.id = t.route_id
        join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = bk.from_stop_index
        join stations fs on fs.id = rfs.station_id
        join route_stops rts on rts.route_id = rt.id and rts.stop_index = bk.to_stop_index
        join stations ts on ts.id = rts.station_id
       where bk.user_id = ${userId}
    ) b
    order by b.departure_at desc, b.created_at desc
  `)) as unknown as BookingSummary[];
  return rows;
}

export async function listBookingSeatsForRun(runId: string) {
  const db = getDb();
  return db
    .select({
      bookingId: bookings.id,
      reference: bookings.reference,
      status: bookings.status,
      userId: bookings.userId,
      fromStopIndex: bookings.fromStopIndex,
      toStopIndex: bookings.toStopIndex,
      travelClass: bookings.travelClass,
      seatNumber: runSeats.seatNumber,
      coachCode: runCoaches.coachCode,
    })
    .from(bookingSeats)
    .innerJoin(bookings, eq(bookingSeats.bookingId, bookings.id))
    .innerJoin(runSeats, eq(bookingSeats.runSeatId, runSeats.id))
    .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
    .where(eq(bookings.runId, runId));
}

/**
 * Controlled seat reassignment: staff can move a confirmed booking to other
 * seats of the same class, with claim replacement inside one transaction.
 */
export async function reassignBookingSeats(input: {
  bookingId: string;
  newSeatIds: string[];
  actorUserId: string;
  actorRole: string;
  reason: string;
}): Promise<{ reference: string; seats: string[] }> {
  const db = getDb();
  const [summary] = await db
    .select({ runId: bookings.runId })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  if (!summary) throw new NotFoundError("That booking could not be found.");

  return db.transaction(async (tx) => {
    await lockRun(tx, summary.runId);
    await expireStaleHolds(tx, summary.runId);

    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .for("update")
      .limit(1);
    if (!booking) throw new NotFoundError("That booking could not be found.");
    if (booking.status !== "confirmed") {
      throw new ConflictError("Only confirmed bookings can be reassigned.");
    }
    if (new Set(input.newSeatIds).size !== booking.passengerCount) {
      throw new ValidationError("Select one replacement seat per passenger.");
    }

    const seats = await tx
      .select({
        id: runSeats.id,
        coachCode: runCoaches.coachCode,
        seatNumber: runSeats.seatNumber,
        travelClass: runCoaches.travelClass,
      })
      .from(runSeats)
      .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
      .where(eq(runCoaches.runId, booking.runId));

    const byId = new Map(seats.map((seat) => [seat.id, seat]));
    const chosen = input.newSeatIds.map((id) => {
      const seat = byId.get(id);
      if (!seat) throw new ValidationError("One of those seats is not on this run.");
      if (seat.travelClass !== booking.travelClass) {
        throw new ValidationError("Replacement seats must be in the same class.");
      }
      return seat;
    });

    const conflicting = (await tx.execute(sql`
      select distinct c.run_seat_id as "runSeatId"
      from seat_segment_claims c
      left join seat_holds h on h.id = c.hold_id
      where c.run_seat_id in (${sql.join(chosen.map((seat) => sql`${seat.id}`), sql`, `)})
        and c.segment_index >= ${booking.fromStopIndex}
        and c.segment_index < ${booking.toStopIndex}
        and c.booking_id::text is distinct from ${booking.id}
        and (c.booking_id is not null
             or (c.hold_id is not null and h.status = 'active' and h.expires_at > now()))
    `)) as unknown as Array<{ runSeatId: string }>;
    if (conflicting.length > 0) {
      throw new ConflictError("One of those seats is no longer free for this journey.");
    }

    const existing = await tx
      .select({ passengerId: bookingSeats.passengerId })
      .from(bookingSeats)
      .where(eq(bookingSeats.bookingId, booking.id))
      .orderBy(bookingSeats.id);

    await tx.delete(seatSegmentClaims).where(eq(seatSegmentClaims.bookingId, booking.id));
    await tx.delete(bookingSeats).where(eq(bookingSeats.bookingId, booking.id));

    await tx.insert(bookingSeats).values(
      chosen.map((seat, index) => ({
        bookingId: booking.id,
        runSeatId: seat.id,
        passengerId: existing[index]!.passengerId,
        farePaise: Math.round(booking.totalFarePaise / booking.passengerCount),
      })),
    );

    const segments = Array.from(
      { length: booking.toStopIndex - booking.fromStopIndex },
      (_, index) => booking.fromStopIndex + index,
    );
    await tx.insert(seatSegmentClaims).values(
      chosen.flatMap((seat) =>
        segments.map((segmentIndex) => ({
          runSeatId: seat.id,
          segmentIndex,
          bookingId: booking.id,
        })),
      ),
    );

    await writeAudit(
      {
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: "booking.seats_reassigned",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          reference: booking.reference,
          reason: input.reason,
          seats: chosen.map((seat) => `${seat.coachCode}-${seat.seatNumber}`),
        },
      },
      tx,
    );

    return {
      reference: booking.reference,
      seats: chosen.map((seat) => `${seat.coachCode} · ${seat.seatNumber}`),
    };
  });
}
