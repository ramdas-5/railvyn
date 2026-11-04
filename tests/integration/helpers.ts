import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  coachTemplates,
  fares,
  routeStops,
  routes,
  runCoaches,
  runSeats,
  stations,
  templateSeats,
  trainRuns,
  trains,
  user,
  type BerthType,
} from "@/db/schema";
import { addDaysToIsoDate, todayInAppZone } from "@/lib/datetime";

let sequence = 0;

export type Fixture = {
  runId: string;
  trainId: string;
  routeId: string;
  seatIds: string[];
  seatIdsByNumber: Map<number, string>;
  userIds: [string, string, string];
  cleanup: () => Promise<void>;
};

const PATTERN: BerthType[] = ["lower", "upper", "lower", "upper", "side_lower", "side_upper"];

export async function createFixture(seatCount = 8): Promise<Fixture> {
  const db = getDb();
  sequence += 1;
  const suffix = `${Date.now().toString(36)}${sequence}`.toUpperCase().slice(-8);

  async function makeStation(label: string) {
    const [row] = await db
      .insert(stations)
      .values({
        code: `${label}${suffix}`.slice(0, 8),
        name: `Test Station ${label} ${suffix}`,
        city: "Test City",
        state: "Test State",
      })
      .returning({ id: stations.id });
    return row!.id;
  }

  const [stationA, stationB, stationC] = await Promise.all([
    makeStation("A"),
    makeStation("B"),
    makeStation("C"),
  ]);

  const [route] = await db
    .insert(routes)
    .values({ code: `TR-${suffix}`, name: `Test Route ${suffix}` })
    .returning({ id: routes.id });

  await db.insert(routeStops).values([
    { routeId: route!.id, stationId: stationA, stopIndex: 0, distanceKm: 0, scheduledOffsetMinutes: 0 },
    { routeId: route!.id, stationId: stationB, stopIndex: 1, distanceKm: 100, scheduledOffsetMinutes: 90 },
    { routeId: route!.id, stationId: stationC, stopIndex: 2, distanceKm: 250, scheduledOffsetMinutes: 210 },
  ]);

  const [train] = await db
    .insert(trains)
    .values({ code: `T${suffix}`.slice(0, 12), name: `Test Train ${suffix}`, routeId: route!.id })
    .returning({ id: trains.id });

  const departureAt = new Date(Date.now() + 5 * 86_400_000);
  const [run] = await db
    .insert(trainRuns)
    .values({
      trainId: train!.id,
      serviceDate: addDaysToIsoDate(todayInAppZone(), 5),
      departureAt,
      arrivalAt: new Date(departureAt.getTime() + 210 * 60_000),
      status: "scheduled",
    })
    .returning({ id: trainRuns.id });

  const [template] = await db
    .insert(coachTemplates)
    .values({
      code: `TP${suffix}`.slice(0, 16),
      name: `Test Coach ${suffix}`,
      travelClass: "sleeper",
      layoutStyle: "test",
      totalSeats: seatCount,
    })
    .returning({ id: coachTemplates.id });

  await db.insert(templateSeats).values(
    Array.from({ length: seatCount }, (_, index) => ({
      templateId: template!.id,
      seatNumber: index + 1,
      berthType: PATTERN[index % PATTERN.length]!,
      deck: "lower",
      rowIndex: Math.floor(index / 2) + 1,
      positionInRow: (index % 2) + 1,
      isAccessible: index === 0,
    })),
  );

  const [coach] = await db
    .insert(runCoaches)
    .values({
      runId: run!.id,
      templateId: template!.id,
      coachCode: "S1",
      position: 1,
      travelClass: "sleeper",
    })
    .returning({ id: runCoaches.id });

  const runSeatRows = await db
    .insert(runSeats)
    .values(
      Array.from({ length: seatCount }, (_, index) => ({
        runCoachId: coach!.id,
        seatNumber: index + 1,
        berthType: PATTERN[index % PATTERN.length]!,
        deck: "lower",
        rowIndex: Math.floor(index / 2) + 1,
        positionInRow: (index % 2) + 1,
        isAccessible: index === 0,
      })),
    )
    .returning({ id: runSeats.id, seatNumber: runSeats.seatNumber });

  await db.insert(fares).values([
    { routeId: route!.id, travelClass: "sleeper", fromStopIndex: 0, toStopIndex: 1, amountPaise: 50_000 },
    { routeId: route!.id, travelClass: "sleeper", fromStopIndex: 1, toStopIndex: 2, amountPaise: 50_000 },
    { routeId: route!.id, travelClass: "sleeper", fromStopIndex: 0, toStopIndex: 2, amountPaise: 90_000 },
  ]);

  const userIds: string[] = [];
  for (const label of ["one", "two", "three"]) {
    const id = randomUUID();
    await db.insert(user).values({
      id,
      name: `Test ${label}`,
      email: `${label}-${suffix.toLowerCase()}@test.railvyn.local`,
    });
    userIds.push(id);
  }

  const seatIds = runSeatRows.map((row) => row.id);
  const seatIdsByNumber = new Map(runSeatRows.map((row) => [row.seatNumber, row.id]));

  return {
    runId: run!.id,
    trainId: train!.id,
    routeId: route!.id,
    seatIds,
    seatIdsByNumber,
    userIds: userIds as [string, string, string],
    cleanup: async () => {
      await db.execute(sql`delete from bookings where run_id = ${run!.id}`);
      await db.execute(sql`delete from seat_holds where run_id = ${run!.id}`);
      await db.execute(sql`delete from waitlist_entries where run_id = ${run!.id}`);
      await db.execute(sql`delete from train_runs where id = ${run!.id}`);
      await db.execute(sql`delete from trains where id = ${train!.id}`);
      await db.execute(sql`delete from routes where id = ${route!.id}`);
      await db.execute(sql`delete from "user" where id in (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`);
    },
  };
}

export function passenger(name = "Test Passenger") {
  return { fullName: name, age: 30, gender: "female" as const };
}
