import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, type DbExecutor } from "@/db";
import { runCoaches, runSeats, trainRuns, trains } from "@/db/schema";

export type SystemKpis = {
  upcomingRuns: number;
  confirmedBookings: number;
  cancelledBookings: number;
  seatsSold: number;
  waitlistWaiting: number;
  activeHolds: number;
  demoRevenuePaise: number;
  occupancyPct: number;
  cancellationRatePct: number;
  seatReuseCount: number;
};

export async function getSystemKpis(executor?: DbExecutor): Promise<SystemKpis> {
  const db = executor ?? getDb();
  const rows = (await db.execute(sql`
    select
      (select count(*)::int from train_runs where departure_at > now() and status <> 'cancelled') as "upcomingRuns",
      (select count(*)::int from bookings where status = 'confirmed') as "confirmedBookings",
      (select count(*)::int from bookings where status = 'cancelled') as "cancelledBookings",
      (select count(*)::int from booking_seats bs join bookings b on b.id = bs.booking_id where b.status = 'confirmed') as "seatsSold",
      (select count(*)::int from waitlist_entries where status = 'waiting') as "waitlistWaiting",
      (select count(*)::int from seat_holds where status = 'active' and expires_at > now()) as "activeHolds",
      (select coalesce(sum(p.amount_paise), 0)::bigint from payments_demo p where p.status = 'succeeded') as "demoRevenuePaise",
      (
        select coalesce(round(100.0 * count(c.id) /
          nullif((
            select sum(capacity * segments)
            from (
              select (select count(*) from run_seats rs join run_coaches rc on rc.id = rs.run_coach_id where rc.run_id = tr.id)::int as capacity,
                     greatest((select count(*) - 1 from route_stops rs2 join trains t2 on t2.route_id = rs2.route_id where t2.id = tr.train_id), 0)::int as segments
              from train_runs tr
            ) caps
          ), 0), 1), 0)::numeric(10,1)
        from seat_segment_claims c
        where c.booking_id is not null
      ) as "occupancyPct",
      (
        select coalesce(round(100.0 * count(*) filter (where status = 'cancelled') / nullif(count(*), 0), 1), 0)::numeric(10,1)
        from bookings
      ) as "cancellationRatePct",
      (
        select count(*)::int from (
          select rs.id
          from seat_segment_claims c
          join run_seats rs on rs.id = c.run_seat_id
          where c.booking_id is not null
          group by rs.id
          having count(distinct c.booking_id) > 1
        ) reused
      ) as "seatReuseCount"
  `)) as unknown as Array<Record<string, unknown>>;

  const row = rows[0] ?? {};
  return {
    upcomingRuns: Number(row.upcomingRuns ?? 0),
    confirmedBookings: Number(row.confirmedBookings ?? 0),
    cancelledBookings: Number(row.cancelledBookings ?? 0),
    seatsSold: Number(row.seatsSold ?? 0),
    waitlistWaiting: Number(row.waitlistWaiting ?? 0),
    activeHolds: Number(row.activeHolds ?? 0),
    demoRevenuePaise: Number(row.demoRevenuePaise ?? 0),
    occupancyPct: Number(row.occupancyPct ?? 0),
    cancellationRatePct: Number(row.cancellationRatePct ?? 0),
    seatReuseCount: Number(row.seatReuseCount ?? 0),
  };
}

/** Occupancy per segment for one run, based on confirmed booking claims. */
export async function getRunSegmentOccupancy(runId: string, executor?: DbExecutor) {
  const db = executor ?? getDb();
  const stops = (await db.execute(sql`
    select rs.stop_index as "stopIndex",
           s.code,
           s.name,
           rs.scheduled_offset_minutes as "offsetMinutes"
    from train_runs tr
    join trains t on t.id = tr.train_id
    join route_stops rs on rs.route_id = t.route_id
    join stations s on s.id = rs.station_id
    where tr.id = ${runId}
    order by rs.stop_index
  `)) as unknown as Array<{
    stopIndex: number;
    code: string;
    name: string;
    offsetMinutes: number;
  }>;

  const rows = (await db.execute(sql`
    select c.segment_index as "segmentIndex",
           count(*)::int as "bookedSeats",
           count(distinct c.booking_id)::int as "bookings"
    from seat_segment_claims c
    join run_seats rs on rs.id = c.run_seat_id
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${runId} and c.booking_id is not null
    group by c.segment_index
    order by c.segment_index
  `)) as unknown as Array<{ segmentIndex: number; bookedSeats: number; bookings: number }>;

  const capacityRows = (await db.execute(sql`
    select count(*)::int as "seats"
    from run_seats rs
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${runId}
  `)) as unknown as Array<{ seats: number }>;
  const capacity = capacityRows[0]?.seats ?? 0;

  return stops.slice(0, -1).map((stop, index) => {
    const occupancy = rows.find((row) => row.segmentIndex === index);
    const bookedSeats = occupancy?.bookedSeats ?? 0;
    return {
      segmentIndex: index,
      from: stop,
      to: stops[index + 1]!,
      bookedSeats,
      capacity,
      occupancyPct: capacity > 0 ? Math.round((bookedSeats / capacity) * 1000) / 10 : 0,
      bookings: occupancy?.bookings ?? 0,
    };
  });
}

/** Coach × segment occupancy matrix (confirmed bookings only). */
export async function getRunCoachMatrix(runId: string, executor?: DbExecutor) {
  const db = executor ?? getDb();
  const runRows = await db
    .select({
      routeId: trains.routeId,
      stopCount: sql<number>`(select count(*)::int from route_stops where route_id = ${trains.routeId})`,
    })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .where(eq(trainRuns.id, runId))
    .limit(1);

  const coaches = await db
    .select({
      coachId: runCoaches.id,
      code: runCoaches.coachCode,
      travelClass: runCoaches.travelClass,
      capacity: sql<number>`count(${runSeats.id})::int`,
    })
    .from(runCoaches)
    .leftJoin(runSeats, eq(runSeats.runCoachId, runCoaches.id))
    .where(eq(runCoaches.runId, runId))
    .groupBy(runCoaches.id)
    .orderBy(runCoaches.position);

  const cells = (await db.execute(sql`
    select rc.id as "coachId",
           c.segment_index as "segmentIndex",
           count(*)::int as "bookedSeats"
    from seat_segment_claims c
    join run_seats rs on rs.id = c.run_seat_id
    join run_coaches rc on rc.id = rs.run_coach_id
    where rc.run_id = ${runId} and c.booking_id is not null
    group by rc.id, c.segment_index
  `)) as unknown as Array<{ coachId: string; segmentIndex: number; bookedSeats: number }>;

  const segmentCount = Math.max(0, (runRows[0]?.stopCount ?? 1) - 1);
  return {
    segmentCount,
    coaches: coaches.map((coach) => ({
      ...coach,
      segments: Array.from({ length: segmentCount }, (_, index) => {
        const cell = cells.find(
          (entry) => entry.coachId === coach.coachId && entry.segmentIndex === index,
        );
        return cell?.bookedSeats ?? 0;
      }),
    })),
  };
}

export async function getBookingsTrend() {
  return (await getDb().execute(sql`
    select to_char(date_trunc('day', created_at), 'Mon DD') as "day",
           count(*)::int as "bookings",
           count(*) filter (where status = 'cancelled')::int as "cancellations"
    from bookings
    where created_at > now() - interval '30 days'
    group by date_trunc('day', created_at)
    order by date_trunc('day', created_at)
  `)) as unknown as Array<{ day: string; bookings: number; cancellations: number }>;
}

export async function getClassUtilisation() {
  const rows = (await getDb().execute(sql`
    select rc.travel_class as "travelClass",
           count(distinct rs.id)::int as "seats",
           count(c.id) filter (where c.booking_id is not null)::int as "segmentClaims",
           (
             select coalesce(sum(b.total_fare_paise), 0)::bigint
             from bookings b
             where b.status = 'confirmed' and b.travel_class = rc.travel_class
           ) as "revenuePaise"
    from run_coaches rc
    join run_seats rs on rs.run_coach_id = rc.id
    left join seat_segment_claims c on c.run_seat_id = rs.id
    group by rc.travel_class
    order by rc.travel_class
  `)) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    travelClass: String(row.travelClass),
    seats: Number(row.seats ?? 0),
    segmentClaims: Number(row.segmentClaims ?? 0),
    revenuePaise: Number(row.revenuePaise ?? 0),
  }));
}

export async function getSeatReuseExamples(limit = 8) {
  return (await getDb().execute(sql`
    select t.name as "trainName",
           r.service_date as "serviceDate",
           rc.coach_code as "coachCode",
           rs.seat_number as "seatNumber",
           count(distinct b.id)::int as "bookings",
           string_agg(distinct coalesce(fs.code, '') || ' to ' || coalesce(ts.code, ''),
             ', ' order by coalesce(fs.code, '') || ' to ' || coalesce(ts.code, '')) as "legs"
    from seat_segment_claims c
    join run_seats rs on rs.id = c.run_seat_id
    join run_coaches rc on rc.id = rs.run_coach_id
    join train_runs r on r.id = rc.run_id
    join trains t on t.id = r.train_id
    join bookings b on b.id = c.booking_id
    join routes rt on rt.id = t.route_id
    join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = b.from_stop_index
    join stations fs on fs.id = rfs.station_id
    join route_stops rts on rts.route_id = rt.id and rts.stop_index = b.to_stop_index
    join stations ts on ts.id = rts.station_id
    where c.booking_id is not null
    group by t.name, r.service_date, rc.coach_code, rs.seat_number
    having count(distinct b.id) > 1
    order by count(distinct b.id) desc, r.service_date desc
    limit ${limit}
  `)) as unknown as Array<{
    trainName: string;
    serviceDate: string;
    coachCode: string;
    seatNumber: number;
    bookings: number;
    legs: string;
  }>;
}

export async function getRecentAudit(limit = 20) {
  return (await getDb().execute(sql`
    select a.action, a.entity_type as "entityType", a.entity_id as "entityId",
           a.metadata, a.created_at as "createdAt", u.name as "actorName",
           a.actor_role as "actorRole"
    from audit_logs a
    left join "user" u on u.id = a.actor_user_id
    order by a.created_at desc
    limit ${limit}
  `)) as unknown as Array<{
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    actorName: string | null;
    actorRole: string | null;
  }>;
}

export async function getDisruptionImpact() {
  return (await getDb().execute(sql`
    select d.id, d.title, d.severity, d.created_at as "createdAt",
           d.resolved_at as "resolvedAt", t.code as "trainCode", t.name as "trainName",
           r.service_date as "serviceDate", count(b.id)::int as "affectedBookings"
    from disruptions d
    join train_runs r on r.id = d.run_id
    join trains t on t.id = r.train_id
    left join bookings b on b.run_id = r.id and b.status = 'confirmed'
    group by d.id, t.code, t.name, r.service_date
    order by d.created_at desc
    limit 10
  `)) as unknown as Array<{
    id: string;
    title: string;
    severity: string;
    createdAt: Date;
    resolvedAt: Date | null;
    trainCode: string;
    trainName: string;
    serviceDate: string;
    affectedBookings: number;
  }>;
}

export async function getUpcomingRunsForOperator(
  trainIds: string[] | "all",
  limit = 10,
) {
  const db = getDb();
  if (trainIds !== "all" && trainIds.length === 0) return [];
  return db
    .select({
      runId: trainRuns.id,
      serviceDate: trainRuns.serviceDate,
      departureAt: trainRuns.departureAt,
      status: trainRuns.status,
      trainCode: trains.code,
      trainName: trains.name,
      bookings: sql<number>`(select count(*)::int from bookings b where b.run_id = ${trainRuns.id} and b.status = 'confirmed')`,
      seatsSold: sql<number>`(select count(*)::int from booking_seats bs join bookings b on b.id = bs.booking_id where b.run_id = ${trainRuns.id} and b.status = 'confirmed')`,
      capacity: sql<number>`(select count(*)::int from run_seats rs join run_coaches rc on rc.id = rs.run_coach_id where rc.run_id = ${trainRuns.id})`,
    })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .where(
      trainIds === "all"
        ? gte(trainRuns.departureAt, new Date())
        : and(inArray(trains.id, trainIds), gte(trainRuns.departureAt, new Date())),
    )
    .orderBy(trainRuns.departureAt)
    .limit(limit);
}
