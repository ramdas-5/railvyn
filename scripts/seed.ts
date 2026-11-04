/**
 * Deterministic demonstration seed for RAILVYN.
 *
 * WARNING: this resets every application table (including auth users) in the
 * configured NEON_DATABASE_URL. Never run it against production data.
 */
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { getDb } from "../src/db";
import {
  account,
  appSettings,
  auditLogs,
  bookingPassengers,
  bookingSeats,
  bookings,
  coachTemplates,
  disruptions,
  fares,
  operatorScopes,
  paymentsDemo,
  roleAssignments,
  routeStops,
  roleAssignments as roles,
  routes,
  runCoaches,
  runSeats,
  seatSegmentClaims,
  stations,
  templateSeats,
  trainRuns,
  trains,
  user,
  waitlistEntries,
  type BerthType,
  type TravelClass,
} from "../src/db/schema";
import { kolkataToUtc, addDaysToIsoDate, todayInAppZone } from "../src/lib/datetime";

const DEMO_PASSWORD = "RailvynDemo#2026";

const STATIONS = [
  { code: "NDLS", name: "New Delhi", city: "New Delhi", state: "Delhi" },
  { code: "GZB", name: "Ghaziabad Junction", city: "Ghaziabad", state: "Uttar Pradesh" },
  { code: "ALJN", name: "Aligarh Junction", city: "Aligarh", state: "Uttar Pradesh" },
  { code: "CNB", name: "Kanpur Central", city: "Kanpur", state: "Uttar Pradesh" },
  { code: "PRYJ", name: "Prayagraj Junction", city: "Prayagraj", state: "Uttar Pradesh" },
  { code: "DDU", name: "Pt. Deen Dayal Upadhyaya", city: "Mughalsarai", state: "Uttar Pradesh" },
  { code: "BSB", name: "Varanasi Junction", city: "Varanasi", state: "Uttar Pradesh" },
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", state: "West Bengal" },
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", state: "Maharashtra" },
  { code: "PUNE", name: "Pune Junction", city: "Pune", state: "Maharashtra" },
  { code: "SUR", name: "Solapur", city: "Solapur", state: "Maharashtra" },
  { code: "KJM", name: "Krishnarajapuram", city: "Bengaluru", state: "Karnataka" },
  { code: "MAS", name: "MGR Chennai Central", city: "Chennai", state: "Tamil Nadu" },
];

const ROUTE_A_STOPS: Array<{ code: string; km: number; offset: number }> = [
  { code: "NDLS", km: 0, offset: 0 },
  { code: "GZB", km: 24, offset: 35 },
  { code: "ALJN", km: 132, offset: 95 },
  { code: "CNB", km: 440, offset: 320 },
  { code: "PRYJ", km: 634, offset: 455 },
  { code: "DDU", km: 776, offset: 560 },
  { code: "BSB", km: 796, offset: 590 },
  { code: "HWH", km: 1447, offset: 1020 },
];

const ROUTE_B_STOPS: Array<{ code: string; km: number; offset: number }> = [
  { code: "CSMT", km: 0, offset: 0 },
  { code: "PUNE", km: 192, offset: 190 },
  { code: "SUR", km: 455, offset: 420 },
  { code: "KJM", km: 1013, offset: 940 },
  { code: "MAS", km: 1280, offset: 1140 },
];

type TemplateSpec = {
  code: string;
  name: string;
  travelClass: TravelClass;
  layoutStyle: string;
  bays: number;
  berthsPerBay: number;
  pattern: BerthType[];
  accessibleNumbers: number[];
};

const TEMPLATE_SPECS: TemplateSpec[] = [
  {
    code: "SL72",
    name: "Sleeper 72",
    travelClass: "sleeper",
    layoutStyle: "8-berth bays",
    bays: 9,
    berthsPerBay: 8,
    pattern: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1, 2],
  },
  {
    code: "3A64",
    name: "AC 3 Tier 64",
    travelClass: "ac3",
    layoutStyle: "8-berth AC bays",
    bays: 8,
    berthsPerBay: 8,
    pattern: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1, 2],
  },
  {
    code: "2A48",
    name: "AC 2 Tier 48",
    travelClass: "ac2",
    layoutStyle: "6-berth AC bays",
    bays: 8,
    berthsPerBay: 6,
    pattern: ["lower", "upper", "lower", "upper", "side_lower", "side_upper"],
    accessibleNumbers: [1],
  },
  {
    code: "CC78",
    name: "Chair Car 78",
    travelClass: "chair",
    layoutStyle: "3 + 3 rows",
    bays: 13,
    berthsPerBay: 6,
    pattern: ["seat", "seat", "seat", "seat", "seat", "seat"],
    accessibleNumbers: [1, 7],
  },
];

const FARE_MATRIX: Record<TravelClass, { basePaise: number; perKmPaise: number }> = {
  sleeper: { basePaise: 15_000, perKmPaise: 35 },
  ac3: { basePaise: 55_000, perKmPaise: 90 },
  ac2: { basePaise: 95_000, perKmPaise: 140 },
  chair: { basePaise: 30_000, perKmPaise: 55 },
};

function roundFare(paise: number): number {
  return Math.max(5_000, Math.round(paise / 500) * 500);
}

async function main() {
  const db = getDb();
  console.log("[railvyn] resetting demonstration data…");
  await db.execute(sql`
    truncate table
      audit_logs, disruptions, payments_demo, waitlist_entries,
      seat_segment_claims, hold_seats, seat_holds, booking_seats,
      booking_passengers, bookings, fares, run_seats, run_coaches,
      template_seats, coach_templates, train_runs, operator_scopes, trains,
      role_assignments, route_stops, routes, stations, app_settings,
      verification, account, session, "user"
    restart identity cascade
  `);

  const stationIds = new Map<string, string>();
  for (const station of STATIONS) {
    const [row] = await db.insert(stations).values(station).returning({ id: stations.id });
    stationIds.set(station.code, row.id);
  }

  const [routeA] = await db
    .insert(routes)
    .values({
      code: "NR-CORRIDOR",
      name: "Northern Corridor",
      description:
        "New Delhi to Howrah across the Ganga plain, with eight ordered demonstration stops.",
    })
    .returning();
  const [routeB] = await db
    .insert(routes)
    .values({
      code: "DECCAN-LINK",
      name: "Deccan Link",
      description: "Mumbai to Chennai via Pune, Solapur and Bengaluru.",
    })
    .returning();

  for (const [index, stop] of ROUTE_A_STOPS.entries()) {
    await db.insert(routeStops).values({
      routeId: routeA!.id,
      stationId: stationIds.get(stop.code)!,
      stopIndex: index,
      distanceKm: stop.km,
      scheduledOffsetMinutes: stop.offset,
    });
  }
  for (const [index, stop] of ROUTE_B_STOPS.entries()) {
    await db.insert(routeStops).values({
      routeId: routeB!.id,
      stationId: stationIds.get(stop.code)!,
      stopIndex: index,
      distanceKm: stop.km,
      scheduledOffsetMinutes: stop.offset,
    });
  }

  const [trainA] = await db
    .insert(trains)
    .values({ code: "12451", name: "Yamuna Express", routeId: routeA!.id })
    .returning();
  const [trainB] = await db
    .insert(trains)
    .values({ code: "22119", name: "Deccan Intercity", routeId: routeB!.id })
    .returning();

  // Fares for every ordered stop pair and every class offered on the route.
  const fareRows: Array<typeof fares.$inferInsert> = [];
  for (const [routeId, stops, classes] of [
    [routeA!.id, ROUTE_A_STOPS, ["sleeper", "ac3", "ac2"] as TravelClass[]],
    [routeB!.id, ROUTE_B_STOPS, ["chair", "ac3", "sleeper"] as TravelClass[]],
  ] as const) {
    for (let i = 0; i < stops.length; i += 1) {
      for (let j = i + 1; j < stops.length; j += 1) {
        const distance = stops[j]!.km - stops[i]!.km;
        for (const travelClass of classes) {
          const matrix = FARE_MATRIX[travelClass];
          fareRows.push({
            routeId,
            travelClass,
            fromStopIndex: i,
            toStopIndex: j,
            amountPaise: roundFare(matrix.basePaise + matrix.perKmPaise * distance),
          });
        }
      }
    }
  }
  for (let i = 0; i < fareRows.length; i += 100) {
    await db.insert(fares).values(fareRows.slice(i, i + 100));
  }

  const templateIds = new Map<string, { id: string; className: TravelClass }>();
  for (const spec of TEMPLATE_SPECS) {
    const totalSeats = spec.bays * spec.berthsPerBay;
    const [template] = await db
      .insert(coachTemplates)
      .values({
        code: spec.code,
        name: spec.name,
        travelClass: spec.travelClass,
        layoutStyle: spec.layoutStyle,
        totalSeats,
      })
      .returning({ id: coachTemplates.id });
    const seatValues = Array.from({ length: totalSeats }, (_, index) => {
      const seatNumber = index + 1;
      const rowIndex = Math.floor(index / spec.berthsPerBay) + 1;
      const positionInRow = (index % spec.berthsPerBay) + 1;
      return {
        templateId: template!.id,
        seatNumber,
        berthType: spec.pattern[index % spec.pattern.length]!,
        deck: "lower",
        rowIndex,
        positionInRow,
        isAccessible: spec.accessibleNumbers.includes(seatNumber),
      };
    });
    await db.insert(templateSeats).values(seatValues);
    templateIds.set(spec.code, { id: template!.id, className: spec.travelClass });
  }

  const today = todayInAppZone();
  const runConfigs: Array<{
    trainId: string;
    trainCode: string;
    serviceDate: string;
    offset: number;
    duration: number;
    status: "scheduled" | "disrupted" | "cancelled" | "completed";
    notes?: string;
    coaches: Array<{ code: string; templateCode: string; position: number; className: TravelClass }>;
  }> = [];

  const trainACoaches = [
    { code: "S1", templateCode: "SL72", position: 1, className: "sleeper" as TravelClass },
    { code: "B1", templateCode: "3A64", position: 2, className: "ac3" as TravelClass },
    { code: "A1", templateCode: "2A48", position: 3, className: "ac2" as TravelClass },
  ];
  const trainBCoaches = [
    { code: "C1", templateCode: "CC78", position: 1, className: "chair" as TravelClass },
    { code: "B1", templateCode: "3A64", position: 2, className: "ac3" as TravelClass },
    { code: "S1", templateCode: "SL72", position: 3, className: "sleeper" as TravelClass },
  ];

  for (let dayOffset = -3; dayOffset <= 14; dayOffset += 1) {
    const serviceDate = addDaysToIsoDate(today, dayOffset);
    const past = dayOffset < 0;
    let status: "scheduled" | "disrupted" | "cancelled" | "completed" = past
      ? "completed"
      : "scheduled";
    let notes: string | undefined;
    if (dayOffset === 5) {
      status = "disrupted";
      notes = "Signal maintenance between CNB and PRYJ. Expect a 25 minute delay.";
    }
    if (dayOffset === 9) {
      status = "cancelled";
      notes = "Demonstration cancellation for operations testing.";
    }
    runConfigs.push({
      trainId: trainA!.id,
      trainCode: "12451",
      serviceDate,
      offset: 370, // 06:10 IST
      duration: 1020,
      status,
      notes,
      coaches: trainACoaches,
    });
    runConfigs.push({
      trainId: trainB!.id,
      trainCode: "22119",
      serviceDate,
      offset: 1005, // 16:45 IST
      duration: 1140,
      status: past ? "completed" : "scheduled",
      coaches: trainBCoaches,
    });
  }

  const runIds: Array<{ id: string; trainId: string; trainCode: string; serviceDate: string; status: string }> = [];
  for (const config of runConfigs) {
    const departureAt = kolkataToUtc(config.serviceDate, config.offset);
    const arrivalAt = new Date(departureAt.getTime() + config.duration * 60_000);
    const [run] = await db
      .insert(trainRuns)
      .values({
        trainId: config.trainId,
        serviceDate: config.serviceDate,
        departureAt,
        arrivalAt,
        status: config.status,
        notes: config.notes ?? null,
      })
      .returning({ id: trainRuns.id });

    for (const coach of config.coaches) {
      const template = templateIds.get(coach.templateCode)!;
      const [runCoach] = await db
        .insert(runCoaches)
        .values({
          runId: run!.id,
          templateId: template.id,
          coachCode: coach.code,
          position: coach.position,
          travelClass: coach.className,
        })
        .returning({ id: runCoaches.id });
      const templateRows = await db
        .select()
        .from(templateSeats)
        .where(sql`${templateSeats.templateId} = ${template.id}`)
        .orderBy(templateSeats.seatNumber);
      await db.insert(runSeats).values(
        templateRows.map((seat) => ({
          runCoachId: runCoach!.id,
          seatNumber: seat.seatNumber,
          berthType: seat.berthType,
          deck: seat.deck,
          rowIndex: seat.rowIndex,
          positionInRow: seat.positionInRow,
          isAccessible: seat.isAccessible,
        })),
      );
    }
    runIds.push({
      id: run!.id,
      trainId: config.trainId,
      trainCode: config.trainCode,
      serviceDate: config.serviceDate,
      status: config.status,
    });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const demoUsers = [
    { email: "passenger@railvyn.demo", name: "Aarav Sharma" },
    { email: "priya@railvyn.demo", name: "Priya Nair" },
    { email: "kabir@railvyn.demo", name: "Kabir Rao" },
    { email: "operator@railvyn.demo", name: "Meera Iyer" },
    { email: "operator2@railvyn.demo", name: "Rohan Das" },
    { email: "admin@railvyn.demo", name: "Dev Malhotra" },
  ];
  const userIds = new Map<string, string>();
  for (const demo of demoUsers) {
    const id = randomUUID();
    await db.insert(user).values({
      id,
      name: demo.name,
      email: demo.email,
      emailVerified: true,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
      updatedAt: new Date(),
    });
    userIds.set(demo.email, id);
    await db.insert(roles).values({ userId: id, role: "passenger" });
  }

  await db.insert(roleAssignments).values([
    { userId: userIds.get("operator@railvyn.demo")!, role: "operator" },
    { userId: userIds.get("operator2@railvyn.demo")!, role: "operator" },
    { userId: userIds.get("admin@railvyn.demo")!, role: "admin" },
  ]);
  await db.insert(operatorScopes).values([
    { userId: userIds.get("operator@railvyn.demo")!, trainId: trainA!.id },
    { userId: userIds.get("operator2@railvyn.demo")!, trainId: trainB!.id },
  ]);

  const findRun = (trainCode: string, dayOffset: number) => {
    const targetDate = addDaysToIsoDate(today, dayOffset);
    return runIds.find(
      (run) => run.trainCode === trainCode && run.serviceDate === targetDate,
    )!;
  };

  const seatsFor = async (runId: string, coachCode: string) =>
    db
      .select({
        id: runSeats.id,
        seatNumber: runSeats.seatNumber,
        coachCode: runCoaches.coachCode,
        travelClass: runCoaches.travelClass,
        berthType: runSeats.berthType,
        isAccessible: runSeats.isAccessible,
      })
      .from(runSeats)
      .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
      .where(sql`${runCoaches.runId} = ${runId} and ${runCoaches.coachCode} = ${coachCode}`)
      .orderBy(runSeats.seatNumber);

  let bookingCounter = 0;
  async function seedBooking(opts: {
    reference: string;
    userId: string;
    runId: string;
    coachCode: string;
    seatNumbers: number[];
    fromStopIndex: number;
    toStopIndex: number;
    travelClass: TravelClass;
    passengers: Array<{ name: string; age: number; gender: string }>;
    status: "confirmed" | "cancelled";
    createdAt: Date;
    reason?: string;
  }) {
    bookingCounter += 1;
    const run = runIds.find((entry) => entry.id === opts.runId)!;
    const [fareRow] = await db
      .select({ amountPaise: fares.amountPaise })
      .from(fares)
      .where(
        sql`${fares.travelClass} = ${opts.travelClass}
            and ${fares.fromStopIndex} = ${opts.fromStopIndex}
            and ${fares.toStopIndex} = ${opts.toStopIndex}
            and ${fares.routeId} = (select route_id from trains where id = ${run.trainId})`,
      )
      .limit(1);
    const farePaise = fareRow?.amountPaise ?? 50_000;
    const seatRows = await seatsFor(opts.runId, opts.coachCode);
    const selected = opts.seatNumbers.map((number) => {
      const seat = seatRows.find((entry) => entry.seatNumber === number);
      if (!seat) throw new Error(`Seed seat ${opts.coachCode}-${number} not found`);
      return seat;
    });

    const [booking] = await db
      .insert(bookings)
      .values({
        reference: opts.reference,
        userId: opts.userId,
        runId: opts.runId,
        fromStopIndex: opts.fromStopIndex,
        toStopIndex: opts.toStopIndex,
        travelClass: opts.travelClass,
        passengerCount: opts.passengers.length,
        totalFarePaise: farePaise * opts.passengers.length,
        status: opts.status,
        contactEmail: demoUsers.find((entry) => userIds.get(entry.email) === opts.userId)!.email,
        contactPhone: "+91 90000 00000",
        idempotencyKey: `seed_booking_${bookingCounter}`,
        createdAt: opts.createdAt,
        cancelledAt: opts.status === "cancelled" ? opts.createdAt : null,
        cancellationReason: opts.reason ?? null,
      })
      .returning({ id: bookings.id });

    const passengerRows = await db
      .insert(bookingPassengers)
      .values(
        opts.passengers.map((passenger, index) => ({
          bookingId: booking!.id,
          fullName: passenger.name,
          age: passenger.age,
          gender: passenger.gender,
          position: index,
        })),
      )
      .returning({ id: bookingPassengers.id });

    await db.insert(bookingSeats).values(
      selected.map((seat, index) => ({
        bookingId: booking!.id,
        runSeatId: seat.id,
        passengerId: passengerRows[index]!.id,
        farePaise,
      })),
    );

    if (opts.status === "confirmed") {
      await db.insert(seatSegmentClaims).values(
        selected.flatMap((seat) =>
          Array.from(
            { length: opts.toStopIndex - opts.fromStopIndex },
            (_, index) => ({
              runSeatId: seat.id,
              segmentIndex: opts.fromStopIndex + index,
              bookingId: booking!.id,
            }),
          ),
        ),
      );
      await db.insert(paymentsDemo).values({
        bookingId: booking!.id,
        amountPaise: farePaise * opts.passengers.length,
        status: "succeeded",
        method: "demo_card",
        idempotencyKey: `seed_payment_${bookingCounter}`,
        createdAt: opts.createdAt,
      });
    } else {
      await db.insert(paymentsDemo).values({
        bookingId: booking!.id,
        amountPaise: farePaise * opts.passengers.length,
        status: "refunded",
        method: "demo_card",
        idempotencyKey: `seed_payment_${bookingCounter}`,
        createdAt: opts.createdAt,
      });
    }

    return booking!.id;
  }

  const futureA = findRun("12451", 2);
  const futureA_alt = findRun("12451", 3);
  const futureB = findRun("22119", 1);
  const pastA = findRun("12451", -2);
  const disruptedA = findRun("12451", 5);

  const passenger = userIds.get("passenger@railvyn.demo")!;
  const priya = userIds.get("priya@railvyn.demo")!;
  const kabir = userIds.get("kabir@railvyn.demo")!;

  const now = Date.now();
  const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000);

  await seedBooking({
    reference: "RVN-A7K2M9PQ",
    userId: passenger,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [42],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "sleeper",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "confirmed",
    createdAt: hoursAgo(50),
  });

  // Same physical seat, later leg — legal journey-aware reuse.
  await seedBooking({
    reference: "RVN-B3N8R5TX",
    userId: priya,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [42],
    fromStopIndex: 3,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(42),
  });

  await seedBooking({
    reference: "RVN-C9P4W6YZ",
    userId: passenger,
    runId: futureA.id,
    coachCode: "B1",
    seatNumbers: [18, 19],
    fromStopIndex: 0,
    toStopIndex: 4,
    travelClass: "ac3",
    passengers: [
      { name: "Aarav Sharma", age: 34, gender: "male" },
      { name: "Isha Sharma", age: 31, gender: "female" },
    ],
    status: "confirmed",
    createdAt: hoursAgo(30),
  });

  await seedBooking({
    reference: "RVN-D4H7J2LM",
    userId: priya,
    runId: futureA.id,
    coachCode: "S1",
    seatNumbers: [44],
    fromStopIndex: 0,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(26),
  });

  await seedBooking({
    reference: "RVN-E6Q2T8KN",
    userId: passenger,
    runId: pastA.id,
    coachCode: "S1",
    seatNumbers: [30],
    fromStopIndex: 0,
    toStopIndex: 7,
    travelClass: "sleeper",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "confirmed",
    createdAt: new Date(now - 8 * 86_400_000),
  });

  await seedBooking({
    reference: "RVN-F8R3V5WQ",
    userId: passenger,
    runId: disruptedA.id,
    coachCode: "A1",
    seatNumbers: [5],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "ac2",
    passengers: [{ name: "Aarav Sharma", age: 34, gender: "male" }],
    status: "cancelled",
    createdAt: hoursAgo(20),
    reason: "Change of travel plan",
  });

  await seedBooking({
    reference: "RVN-G2X7Z4AC",
    userId: priya,
    runId: futureB.id,
    coachCode: "C1",
    seatNumbers: [12],
    fromStopIndex: 0,
    toStopIndex: 1,
    travelClass: "chair",
    passengers: [{ name: "Priya Nair", age: 29, gender: "female" }],
    status: "confirmed",
    createdAt: hoursAgo(12),
  });

  await seedBooking({
    reference: "RVN-H5M9P3DE",
    userId: kabir,
    runId: futureA_alt.id,
    coachCode: "S1",
    seatNumbers: [7],
    fromStopIndex: 0,
    toStopIndex: 3,
    travelClass: "sleeper",
    passengers: [{ name: "Kabir Rao", age: 41, gender: "male" }],
    status: "confirmed",
    createdAt: hoursAgo(8),
  });

  await db.insert(waitlistEntries).values([
    {
      userId: kabir,
      runId: futureA.id,
      fromStopIndex: 0,
      toStopIndex: 7,
      travelClass: "ac2",
      passengerCount: 1,
      priority: 0,
      status: "waiting",
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(14),
    },
    {
      userId: priya,
      runId: futureA.id,
      fromStopIndex: 0,
      toStopIndex: 7,
      travelClass: "ac2",
      passengerCount: 2,
      priority: 1,
      status: "waiting",
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(9),
    },
  ]);

  await db.insert(disruptions).values({
    runId: disruptedA.id,
    title: "Signal maintenance between CNB and PRYJ",
    description:
      "Demonstration incident: a 25 minute delay is expected. Operations has been notified; no seats were released.",
    severity: "warning",
    createdBy: userIds.get("operator@railvyn.demo")!,
    createdAt: hoursAgo(6),
  });

  await db.insert(appSettings).values([
    { key: "holdTtlSeconds", value: 300 },
    { key: "waitlistOfferTtlSeconds", value: 600 },
    { key: "maxSeatsPerBooking", value: 6 },
    { key: "allowWaitlist", value: true },
    { key: "demoNotice", value: "Demonstration data, not official railway inventory." },
  ]);

  await db.insert(auditLogs).values([
    {
      actorUserId: userIds.get("admin@railvyn.demo")!,
      actorRole: "admin",
      action: "seed.completed",
      entityType: "system",
      entityId: null,
      metadata: { runs: runIds.length, note: "Deterministic demonstration dataset generated." },
    },
    {
      actorUserId: userIds.get("operator@railvyn.demo")!,
      actorRole: "operator",
      action: "disruption.created",
      entityType: "disruption",
      entityId: disruptedA.id,
      metadata: { severity: "warning", runId: disruptedA.id },
    },
  ]);

  console.log("[railvyn] seed complete.");
  console.log(`  Runs: ${runIds.length} · stations: ${STATIONS.length} · demo bookings: ${bookingCounter}`);
  console.log(`  Demo password for every account: ${DEMO_PASSWORD}`);
  for (const demo of demoUsers) console.log(`  · ${demo.email} (${demo.name})`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[railvyn] seed failed", error);
  process.exit(1);
});
