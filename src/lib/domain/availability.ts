import { and, eq, sql } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db";
import {
  coachTemplates,
  routeStops,
  routes,
  runCoaches,
  runSeats,
  stations,
  trainRuns,
  trains,
  type BerthType,
  type TravelClass,
} from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getFarePaise } from "./fare";

export type SeatStatus = "available" | "held" | "booked";

export type SeatView = {
  id: string;
  coachId: string;
  coachCode: string;
  coachPosition: number;
  seatNumber: number;
  berthType: BerthType;
  deck: string;
  rowIndex: number;
  positionInRow: number;
  isAccessible: boolean;
  status: SeatStatus;
  /** Free for this leg, but already sold or held on a different leg. */
  bookedOnOtherLegs: boolean;
};

export type CoachView = {
  id: string;
  code: string;
  position: number;
  travelClass: TravelClass;
  templateName: string;
  layoutStyle: string;
  seats: SeatView[];
};

export type ClassAvailability = {
  travelClass: TravelClass;
  totalSeats: number;
  availableSeats: number;
};

export type JourneyStop = {
  stopIndex: number;
  stationId: string;
  code: string;
  name: string;
  city: string;
  state: string;
  distanceKm: number;
  offsetMinutes: number;
};

export type RunDetails = {
  run: {
    id: string;
    serviceDate: string;
    departureAt: Date;
    arrivalAt: Date;
    status: "scheduled" | "disrupted" | "cancelled" | "completed";
    notes: string | null;
  };
  train: { id: string; code: string; name: string; routeId: string };
  route: { id: string; code: string; name: string; description: string | null };
  stops: JourneyStop[];
  coaches: CoachView[];
  classes: ClassAvailability[];
};

export type JourneySearchResult = {
  runId: string;
  serviceDate: string;
  departureAt: Date;
  arrivalAt: Date;
  status: RunDetails["run"]["status"];
  notes: string | null;
  trainCode: string;
  trainName: string;
  routeName: string;
  fromStop: JourneyStop;
  toStop: JourneyStop;
  durationMinutes: number;
  distanceKm: number;
  classes: Array<ClassAvailability & { farePaise: number }>;
};

export type ClaimRow = {
  runSeatId: string;
  segmentIndex: number;
  holdId: string | null;
  bookingId: string | null;
  holdStatus: string | null;
  holdExpiresAt: Date | string | null;
};

export function claimIsLive(claim: ClaimRow, now = new Date()): boolean {
  if (claim.bookingId) return true;
  if (!claim.holdId) return false;
  return (
    claim.holdStatus === "active" &&
    claim.holdExpiresAt !== null &&
    new Date(claim.holdExpiresAt).getTime() > now.getTime()
  );
}

export function claimOverlaps(
  claim: ClaimRow,
  fromStopIndex: number,
  toStopIndex: number,
  now = new Date(),
): boolean {
  return (
    claim.segmentIndex >= fromStopIndex &&
    claim.segmentIndex < toStopIndex &&
    claimIsLive(claim, now)
  );
}

export async function loadRunClaims(
  runId: string,
  executor?: DbExecutor,
): Promise<ClaimRow[]> {
  const db = executor ?? getDb();
  return (await db.execute(sql`
    select c.run_seat_id as "runSeatId",
           c.segment_index as "segmentIndex",
           c.hold_id as "holdId",
           c.booking_id as "bookingId",
           h.status as "holdStatus",
           h.expires_at as "holdExpiresAt"
    from seat_segment_claims c
    left join seat_holds h on h.id = c.hold_id
    join run_seats rs on rs.id = c.run_seat_id
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${runId}
  `)) as unknown as ClaimRow[];
}

/** Loads network, coach and seat inventory for one dated run. */
export async function getRunDetails(
  runId: string,
  executor?: DbExecutor,
): Promise<RunDetails> {
  const db = executor ?? getDb();
  const [runRow] = await db
    .select({
      run: {
        id: trainRuns.id,
        serviceDate: trainRuns.serviceDate,
        departureAt: trainRuns.departureAt,
        arrivalAt: trainRuns.arrivalAt,
        status: trainRuns.status,
        notes: trainRuns.notes,
      },
      train: {
        id: trains.id,
        code: trains.code,
        name: trains.name,
        routeId: trains.routeId,
      },
      route: {
        id: routes.id,
        code: routes.code,
        name: routes.name,
        description: routes.description,
      },
    })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .innerJoin(routes, eq(trains.routeId, routes.id))
    .where(eq(trainRuns.id, runId))
    .limit(1);

  if (!runRow) throw new NotFoundError("That train run could not be found.");

  const stopRows = await db
    .select({
      stopIndex: routeStops.stopIndex,
      stationId: stations.id,
      code: stations.code,
      name: stations.name,
      city: stations.city,
      state: stations.state,
      distanceKm: routeStops.distanceKm,
      offsetMinutes: routeStops.scheduledOffsetMinutes,
    })
    .from(routeStops)
    .innerJoin(stations, eq(routeStops.stationId, stations.id))
    .where(eq(routeStops.routeId, runRow.route.id))
    .orderBy(routeStops.stopIndex);

  const seatRows = await db
    .select({
      seatId: runSeats.id,
      coachId: runCoaches.id,
      coachCode: runCoaches.coachCode,
      coachPosition: runCoaches.position,
      travelClass: runCoaches.travelClass,
      templateName: coachTemplates.name,
      layoutStyle: coachTemplates.layoutStyle,
      seatNumber: runSeats.seatNumber,
      berthType: runSeats.berthType,
      deck: runSeats.deck,
      rowIndex: runSeats.rowIndex,
      positionInRow: runSeats.positionInRow,
      isAccessible: runSeats.isAccessible,
    })
    .from(runSeats)
    .innerJoin(runCoaches, eq(runSeats.runCoachId, runCoaches.id))
    .innerJoin(coachTemplates, eq(runCoaches.templateId, coachTemplates.id))
    .where(eq(runCoaches.runId, runId))
    .orderBy(
      runCoaches.position,
      runSeats.rowIndex,
      runSeats.positionInRow,
      runSeats.seatNumber,
    );

  const claimRows = await loadRunClaims(runId, executor);
  const now = new Date();
  const liveClaims = claimRows.filter((claim) => claimIsLive(claim, now));

  const coachMap = new Map<string, CoachView>();
  for (const row of seatRows) {
    let coach = coachMap.get(row.coachId);
    if (!coach) {
      coach = {
        id: row.coachId,
        code: row.coachCode,
        position: row.coachPosition,
        travelClass: row.travelClass,
        templateName: row.templateName,
        layoutStyle: row.layoutStyle,
        seats: [],
      };
      coachMap.set(row.coachId, coach);
    }
    const conflicts = liveClaims.filter((claim) => claim.runSeatId === row.seatId);
    coach.seats.push({
      id: row.seatId,
      coachId: row.coachId,
      coachCode: row.coachCode,
      coachPosition: row.coachPosition,
      seatNumber: row.seatNumber,
      berthType: row.berthType,
      deck: row.deck,
      rowIndex: row.rowIndex,
      positionInRow: row.positionInRow,
      isAccessible: row.isAccessible,
      status: conflicts.some((claim) => claim.bookingId)
        ? "booked"
        : conflicts.length > 0
          ? "held"
          : "available",
      bookedOnOtherLegs: conflicts.length > 0,
    });
  }

  const coaches = [...coachMap.values()].sort((a, b) => a.position - b.position);
  return { ...runRow, stops: stopRows, coaches, classes: classesFromCoaches(coaches) };
}

function classesFromCoaches(coaches: CoachView[]): ClassAvailability[] {
  const map = new Map<TravelClass, ClassAvailability>();
  for (const coach of coaches) {
    const entry = map.get(coach.travelClass) ?? {
      travelClass: coach.travelClass,
      totalSeats: 0,
      availableSeats: 0,
    };
    entry.totalSeats += coach.seats.length;
    map.set(coach.travelClass, entry);
  }
  return [...map.values()].sort((a, b) => a.travelClass.localeCompare(b.travelClass));
}

/**
 * Derives journey-specific availability for the interactive coach map.
 * This is display data only; the allocation transaction revalidates claims.
 */
export async function getSeatMapForLeg(
  runId: string,
  fromStopIndex: number,
  toStopIndex: number,
  travelClass: TravelClass,
): Promise<{
  details: RunDetails;
  coaches: CoachView[];
  classAvailability: ClassAvailability;
}> {
  const details = await getRunDetails(runId);
  if (
    !Number.isInteger(fromStopIndex) ||
    !Number.isInteger(toStopIndex) ||
    fromStopIndex < 0 ||
    toStopIndex > details.stops.length - 1 ||
    fromStopIndex >= toStopIndex
  ) {
    throw new ValidationError("Choose a valid boarding and alighting station.");
  }

  const claimRows = await loadRunClaims(runId);
  const now = new Date();
  const coaches = details.coaches
    .filter((coach) => coach.travelClass === travelClass)
    .map((coach) => ({
      ...coach,
      seats: coach.seats.map((seat) => {
        const seatClaims = claimRows.filter((claim) => claim.runSeatId === seat.id);
        const liveConflicts = seatClaims.filter((claim) =>
          claimOverlaps(claim, fromStopIndex, toStopIndex, now),
        );
        const otherLeg = seatClaims.some(
          (claim) =>
            claim.segmentIndex >= fromStopIndex &&
            claim.segmentIndex < toStopIndex
              ? false
              : claimIsLive(claim, now),
        );
        const status: SeatStatus = liveConflicts.some((claim) => claim.bookingId)
          ? "booked"
          : liveConflicts.length > 0
            ? "held"
            : "available";
        return { ...seat, status, bookedOnOtherLegs: otherLeg };
      }),
    }));

  const allSeats = coaches.flatMap((coach) => coach.seats);
  return {
    details,
    coaches,
    classAvailability: {
      travelClass,
      totalSeats: allSeats.length,
      availableSeats: allSeats.filter((seat) => seat.status === "available").length,
    },
  };
}

/** SQL aggregate used by search and the availability API. */
export async function getClassAvailability(
  runId: string,
  fromStopIndex: number,
  toStopIndex: number,
  executor?: DbExecutor,
): Promise<ClassAvailability[]> {
  const db = executor ?? getDb();
  return (await db.execute(sql`
    select rc.travel_class as "travelClass",
           count(rs.id)::int as "totalSeats",
           count(rs.id) filter (where not exists (
             select 1
             from seat_segment_claims c
             left join seat_holds h on h.id = c.hold_id
             where c.run_seat_id = rs.id
               and c.segment_index >= ${fromStopIndex}
               and c.segment_index < ${toStopIndex}
               and (c.booking_id is not null
                    or (c.hold_id is not null and h.status = 'active' and h.expires_at > now()))
           ))::int as "availableSeats"
    from run_seats rs
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${runId}
    group by rc.travel_class
    order by rc.travel_class
  `)) as unknown as ClassAvailability[];
}

export type SearchInput = {
  fromStationId: string;
  toStationId: string;
  serviceDate: string;
  travelClass?: TravelClass | "any";
  passengers?: number;
};

/** Finds dated runs with valid ordered stop pairs and journey-specific seats. */
export async function searchJourneys(
  input: SearchInput,
  executor?: DbExecutor,
): Promise<JourneySearchResult[]> {
  const db = executor ?? getDb();
  if (input.fromStationId === input.toStationId) {
    throw new ValidationError("Boarding and destination stations must be different.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.serviceDate)) {
    throw new ValidationError("Choose a valid journey date.");
  }

  const fromStops = await db
    .select({ routeId: routeStops.routeId, stopIndex: routeStops.stopIndex })
    .from(routeStops)
    .where(eq(routeStops.stationId, input.fromStationId));
  const toStops = await db
    .select({ routeId: routeStops.routeId, stopIndex: routeStops.stopIndex })
    .from(routeStops)
    .where(eq(routeStops.stationId, input.toStationId));

  const pairsByRoute = new Map<string, { fromIndex: number; toIndex: number }>();
  for (const from of fromStops) {
    const to = toStops.find(
      (candidate) =>
        candidate.routeId === from.routeId && candidate.stopIndex > from.stopIndex,
    );
    if (to) {
      pairsByRoute.set(from.routeId, { fromIndex: from.stopIndex, toIndex: to.stopIndex });
    }
  }
  if (pairsByRoute.size === 0) return [];

  const runRows = await db
    .select({
      runId: trainRuns.id,
      serviceDate: trainRuns.serviceDate,
      departureAt: trainRuns.departureAt,
      arrivalAt: trainRuns.arrivalAt,
      status: trainRuns.status,
      notes: trainRuns.notes,
      trainCode: trains.code,
      trainName: trains.name,
      routeId: routes.id,
      routeName: routes.name,
    })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .innerJoin(routes, eq(trains.routeId, routes.id))
    .where(
      and(
        eq(trainRuns.serviceDate, input.serviceDate),
        sql`${trainRuns.status} <> 'cancelled'`,
        sql`${trainRuns.departureAt} > now()`,
      ),
    )
    .orderBy(trainRuns.departureAt);

  const results: JourneySearchResult[] = [];
  for (const run of runRows) {
    const pair = pairsByRoute.get(run.routeId);
    if (!pair) continue;

    const details = await getRunDetails(run.runId, executor);
    const fromStop = details.stops[pair.fromIndex];
    const toStop = details.stops[pair.toIndex];
    if (!fromStop || !toStop) continue;

    const availability = await getClassAvailability(
      run.runId,
      pair.fromIndex,
      pair.toIndex,
      executor,
    );

    const classes: JourneySearchResult["classes"] = [];
    for (const entry of availability) {
      if (
        input.travelClass &&
        input.travelClass !== "any" &&
        entry.travelClass !== input.travelClass
      ) {
        continue;
      }
      if ((input.passengers ?? 1) > entry.availableSeats) continue;
      const farePaise = await getFarePaise(
        run.routeId,
        entry.travelClass,
        pair.fromIndex,
        pair.toIndex,
        executor,
      );
      classes.push({ ...entry, farePaise });
    }
    if (classes.length === 0) continue;

    results.push({
      runId: run.runId,
      serviceDate: run.serviceDate,
      departureAt: run.departureAt,
      arrivalAt: run.arrivalAt,
      status: run.status,
      notes: run.notes,
      trainCode: run.trainCode,
      trainName: run.trainName,
      routeName: run.routeName,
      fromStop,
      toStop,
      durationMinutes: toStop.offsetMinutes - fromStop.offsetMinutes,
      distanceKm: toStop.distanceKm - fromStop.distanceKm,
      classes,
    });
  }

  return results;
}

export async function getStations(executor?: DbExecutor) {
  const db = executor ?? getDb();
  return db
    .select({
      id: stations.id,
      code: stations.code,
      name: stations.name,
      city: stations.city,
    })
    .from(stations)
    .orderBy(stations.name);
}

/** Journey-specific class summary for an entire run (used by operator views). */
export async function getRunClassOccupancy(runId: string) {
  const details = await getRunDetails(runId);
  const segments = Math.max(1, details.stops.length - 1);
  const byClass = await getClassAvailability(runId, 0, segments);
  return { details, byClass };
}
