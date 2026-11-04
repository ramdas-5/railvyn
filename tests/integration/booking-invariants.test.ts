import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import {
  bookingSeats,
  bookings,
  paymentsDemo,
  seatHolds,
  seatSegmentClaims,
  waitlistEntries,
} from "@/db/schema";
import {
  createHold,
  releaseHold,
  type CreateHoldInput,
} from "@/lib/domain/allocation";
import {
  cancelBooking,
  confirmHold,
  reassignBookingSeats,
} from "@/lib/domain/reservations";
import { joinWaitlist } from "@/lib/domain/waitlist";
import { NoSeatsAvailableError, HoldExpiredError } from "@/lib/errors";
import { createFixture, passenger, type Fixture } from "./helpers";

const databaseUrl = process.env.NEON_DATABASE_URL;
const fixtures: Fixture[] = [];

async function fixture(seats = 8) {
  const created = await createFixture(seats);
  fixtures.push(created);
  return created;
}

function holdInput(
  f: Fixture,
  userId: string,
  overrides: Partial<CreateHoldInput> = {},
): CreateHoldInput {
  return {
    userId,
    runId: f.runId,
    fromStopIndex: 0,
    toStopIndex: 2,
    travelClass: "sleeper",
    passengerCount: 1,
    idempotencyKey: `test_${randomUUID()}`,
    ...overrides,
  };
}

afterAll(async () => {
  for (const f of fixtures) {
    try {
      await f.cleanup();
    } catch (error) {
      console.warn("[railvyn tests] fixture cleanup failed", error);
    }
  }
});

describe.skipIf(!databaseUrl)("seat allocation invariants (PostgreSQL)", () => {
  it("prevents two passengers from holding the same seat on overlapping segments", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(1)!;

    const first = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [seatId] }),
    );
    expect(first.holdId).toBeTruthy();

    await expect(
      createHold(
        holdInput(f, f.userIds[1], {
          fromStopIndex: 1,
          toStopIndex: 2,
          selectedSeatIds: [seatId],
        }),
      ),
    ).rejects.toBeInstanceOf(NoSeatsAvailableError);

    const claims = await getDb()
      .select()
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.runSeatId} = ${seatId}`);
    expect(claims).toHaveLength(2); // segments 0 and 1 of the first journey only
    expect(new Set(claims.map((claim) => claim.holdId))).toEqual(new Set([first.holdId]));
  });

  it("allows the same physical seat on adjacent, non-overlapping legs", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(2)!;

    const first = await createHold(
      holdInput(f, f.userIds[0], {
        fromStopIndex: 0,
        toStopIndex: 1,
        selectedSeatIds: [seatId],
      }),
    );
    const second = await createHold(
      holdInput(f, f.userIds[1], {
        fromStopIndex: 1,
        toStopIndex: 2,
        selectedSeatIds: [seatId],
      }),
    );

    expect(second.holdId).not.toBe(first.holdId);
    const claims = await getDb()
      .select()
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.runSeatId} = ${seatId}`);
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map((claim) => claim.segmentIndex))).toEqual(new Set([0, 1]));
  });

  it("rejects a stale UI selection when another passenger takes the seat first", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(3)!;
    await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [seatId] }),
    );
    await expect(
      createHold(holdInput(f, f.userIds[1], { selectedSeatIds: [seatId] })),
    ).rejects.toBeInstanceOf(NoSeatsAvailableError);
  });

  it("makes confirmation idempotent — one booking, one demo payment", async () => {
    const f = await fixture();
    const hold = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [f.seatIdsByNumber.get(4)!] }),
    );
    const key = `confirm_${randomUUID()}`;
    const first = await confirmHold({
      userId: f.userIds[0],
      holdId: hold.holdId,
      passengers: [passenger("First Passenger")],
      contactEmail: "first@test.railvyn.local",
      idempotencyKey: key,
    });
    const second = await confirmHold({
      userId: f.userIds[0],
      holdId: hold.holdId,
      passengers: [passenger("First Passenger")],
      contactEmail: "first@test.railvyn.local",
      idempotencyKey: key,
    });

    expect(second.bookingId).toBe(first.bookingId);
    expect(second.alreadyConfirmed).toBe(true);

    const rows = await getDb()
      .select({ id: bookings.id })
      .from(bookings)
      .where(sql`${bookings.runId} = ${f.runId}`);
    expect(rows).toHaveLength(1);
    const payments = await getDb()
      .select({ id: paymentsDemo.id })
      .from(paymentsDemo)
      .where(sql`${paymentsDemo.bookingId} = ${first.bookingId}`);
    expect(payments).toHaveLength(1);

    const claims = await getDb()
      .select({ bookingId: seatSegmentClaims.bookingId })
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.runSeatId} = ${f.seatIdsByNumber.get(4)!}`);
    expect(claims).toHaveLength(2);
    expect(claims.every((claim) => claim.bookingId === first.bookingId)).toBe(true);
  });

  it("releases an expired hold's claims and rejects stale confirmation", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(5)!;
    const stale = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [seatId] }),
    );
    await getDb()
      .update(seatHolds)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(sql`${seatHolds.id} = ${stale.holdId}`);

    const fresh = await createHold(
      holdInput(f, f.userIds[1], { selectedSeatIds: [seatId] }),
    );
    expect(fresh.holdId).not.toBe(stale.holdId);

    await expect(
      confirmHold({
        userId: f.userIds[0],
        holdId: stale.holdId,
        passengers: [passenger()],
        contactEmail: "late@test.railvyn.local",
      }),
    ).rejects.toBeInstanceOf(HoldExpiredError);
  });

  it("rolls back the whole group when every requested seat cannot be held", async () => {
    const f = await fixture(6);
    await createHold(holdInput(f, f.userIds[0], { passengerCount: 4 }));
    const before = await getDb()
      .select({ id: seatHolds.id })
      .from(seatHolds)
      .where(sql`${seatHolds.runId} = ${f.runId} and ${seatHolds.userId} = ${f.userIds[1]}`);

    await expect(
      createHold(holdInput(f, f.userIds[1], { passengerCount: 3 })),
    ).rejects.toBeInstanceOf(NoSeatsAvailableError);

    const after = await getDb()
      .select({ id: seatHolds.id })
      .from(seatHolds)
      .where(sql`${seatHolds.runId} = ${f.runId} and ${seatHolds.userId} = ${f.userIds[1]}`);
    expect(after).toHaveLength(before.length);
  });

  it("releases claims on cancellation and offers the seat to the waitlist", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(6)!;
    const hold = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [seatId] }),
    );
    const confirmed = await confirmHold({
      userId: f.userIds[0],
      holdId: hold.holdId,
      passengers: [passenger("Cancelling Passenger")],
      contactEmail: "cancel@test.railvyn.local",
    });

    const wait = await joinWaitlist({
      userId: f.userIds[1],
      runId: f.runId,
      fromStopIndex: 0,
      toStopIndex: 2,
      travelClass: "sleeper",
      passengerCount: 1,
    });
    expect(wait.created).toBe(true);

    const cancelled = await cancelBooking({
      bookingId: confirmed.bookingId,
      actorUserId: f.userIds[0],
      actorRole: "passenger",
      reason: "Test cancellation",
    });
    expect(cancelled.alreadyCancelled).toBe(false);
    expect(cancelled.promotedEntryId).toBe(wait.entry.id);

    const cancelledClaims = await getDb()
      .select({ id: seatSegmentClaims.id })
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.bookingId} = ${confirmed.bookingId}`);
    expect(cancelledClaims).toHaveLength(0);

    const [entry] = await getDb()
      .select()
      .from(waitlistEntries)
      .where(sql`${waitlistEntries.id} = ${wait.entry.id}`);
    expect(entry!.status).toBe("offered");
    expect(entry!.offeredHoldId).toBeTruthy();

    const repeat = await cancelBooking({
      bookingId: confirmed.bookingId,
      actorUserId: f.userIds[0],
      actorRole: "passenger",
    });
    expect(repeat.alreadyCancelled).toBe(true);

    // The offered hold is owned by the waitlisted user and can be confirmed.
    const offer = await confirmHold({
      userId: f.userIds[1],
      holdId: entry!.offeredHoldId!,
      passengers: [passenger("Waitlisted Passenger")],
      contactEmail: "waitlist@test.railvyn.local",
    });
    expect(offer.bookingId).toBeTruthy();
  });

  it("releases claims when a passenger abandons a hold", async () => {
    const f = await fixture();
    const seatId = f.seatIdsByNumber.get(7)!;
    const hold = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [seatId] }),
    );
    await releaseHold({ holdId: hold.holdId, userId: f.userIds[0] });
    const claims = await getDb()
      .select({ id: seatSegmentClaims.id })
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.holdId} = ${hold.holdId}`);
    expect(claims).toHaveLength(0);
  });

  it("enforces the unique segment claim constraint at database level", async () => {
    const f = await fixture();
    const hold = await createHold(holdInput(f, f.userIds[0], { passengerCount: 1 }));
    const seatId = (await getDb()
      .select({ id: seatSegmentClaims.runSeatId })
      .from(seatSegmentClaims)
      .where(sql`${seatSegmentClaims.holdId} = ${hold.holdId}`)
      .limit(1))[0]!.id;

    await expect(
      getDb().insert(seatSegmentClaims).values({
        runSeatId: seatId,
        segmentIndex: 0,
        holdId: hold.holdId,
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

describe.skipIf(!databaseUrl)("controlled seat reassignment", () => {
  it("moves a confirmed booking to free seats in the same class", async () => {
    const f = await fixture();
    const originalSeat = f.seatIdsByNumber.get(1)!;
    const targetSeat = f.seatIdsByNumber.get(8)!;
    const hold = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [originalSeat] }),
    );
    const confirmed = await confirmHold({
      userId: f.userIds[0],
      holdId: hold.holdId,
      passengers: [passenger("Reassigned Passenger")],
      contactEmail: "reassign@test.railvyn.local",
    });

    const result = await reassignBookingSeats({
      bookingId: confirmed.bookingId,
      newSeatIds: [targetSeat],
      actorUserId: f.userIds[2],
      actorRole: "operator",
      reason: "Coach change",
    });
    expect(result.seats).toHaveLength(1);

    const seats = await getDb()
      .select({ runSeatId: bookingSeats.runSeatId })
      .from(bookingSeats)
      .where(sql`${bookingSeats.bookingId} = ${confirmed.bookingId}`);
    expect(seats.map((seat) => seat.runSeatId)).toEqual([targetSeat]);
  });

  it("refuses reassignment onto a seat held for an overlapping leg", async () => {
    const f = await fixture();
    const hold = await createHold(
      holdInput(f, f.userIds[0], { selectedSeatIds: [f.seatIdsByNumber.get(2)!] }),
    );
    const confirmed = await confirmHold({
      userId: f.userIds[0],
      holdId: hold.holdId,
      passengers: [passenger()],
      contactEmail: "reassign2@test.railvyn.local",
    });
    await createHold(holdInput(f, f.userIds[1], { selectedSeatIds: [f.seatIdsByNumber.get(3)!] }));

    await expect(
      reassignBookingSeats({
        bookingId: confirmed.bookingId,
        newSeatIds: [f.seatIdsByNumber.get(3)!],
        actorUserId: f.userIds[2],
        actorRole: "operator",
        reason: "Conflict test",
      }),
    ).rejects.toBeTruthy();
  });
});
