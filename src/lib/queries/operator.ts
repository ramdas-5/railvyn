import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import type { BerthType, TravelClass } from "@/db/schema";

function trainScope(trainIds: string[] | "all"): SQL {
  if (trainIds === "all") return sql`true`;
  if (trainIds.length === 0) return sql`false`;
  return sql`t.id in (${sql.join(
    trainIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

export type OperatorStats = {
  upcomingRuns: number;
  confirmedBookings: number;
  seatsSold: number;
  activeHolds: number;
  waitlistOpen: number;
  activeDisruptions: number;
};

export async function getOperatorStats(
  trainIds: string[] | "all",
): Promise<OperatorStats> {
  const scope = trainScope(trainIds);
  const rows = (await getDb().execute(sql`
    select
      (select count(*)::int
         from train_runs tr join trains t on t.id = tr.train_id
        where ${scope} and tr.departure_at > now() and tr.status <> 'cancelled') as "upcomingRuns",
      (select count(*)::int
         from bookings b
         join train_runs tr on tr.id = b.run_id
         join trains t on t.id = tr.train_id
        where ${scope} and b.status = 'confirmed') as "confirmedBookings",
      (select count(*)::int
         from booking_seats bs
         join bookings b on b.id = bs.booking_id
         join train_runs tr on tr.id = b.run_id
         join trains t on t.id = tr.train_id
        where ${scope} and b.status = 'confirmed') as "seatsSold",
      (select count(*)::int
         from seat_holds h
         join train_runs tr on tr.id = h.run_id
         join trains t on t.id = tr.train_id
        where ${scope} and h.status = 'active' and h.expires_at > now()) as "activeHolds",
      (select count(*)::int
         from waitlist_entries w
         join train_runs tr on tr.id = w.run_id
         join trains t on t.id = tr.train_id
        where ${scope} and w.status in ('waiting', 'offered')) as "waitlistOpen",
      (select count(*)::int
         from disruptions d
         join train_runs tr on tr.id = d.run_id
         join trains t on t.id = tr.train_id
        where ${scope} and d.resolved_at is null) as "activeDisruptions"
  `)) as unknown as OperatorStats[];
  return (
    rows[0] ?? {
      upcomingRuns: 0,
      confirmedBookings: 0,
      seatsSold: 0,
      activeHolds: 0,
      waitlistOpen: 0,
      activeDisruptions: 0,
    }
  );
}

export type OperatorBookingRow = {
  id: string;
  runId: string;
  reference: string;
  status: "confirmed" | "cancelled";
  serviceDate: string;
  departureAt: Date;
  travelClass: TravelClass;
  passengerCount: number;
  fromStopIndex: number;
  toStopIndex: number;
  totalFarePaise: number;
  trainCode: string;
  trainName: string;
  passengerName: string;
  passengerEmail: string;
  fromCode: string;
  toCode: string;
  seatLabels: string;
};

export async function getOperatorBookings(
  trainIds: string[] | "all",
  query = "",
  limit = 100,
): Promise<OperatorBookingRow[]> {
  const filters: SQL[] = [trainScope(trainIds)];
  const trimmed = query.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    filters.push(sql`(
      b.reference ilike ${like}
      or u.email ilike ${like}
      or u.name ilike ${like}
      or t.code ilike ${like}
    )`);
  }
  const where = sql.join(filters, sql` and `);

  return (await getDb().execute(sql`
    select b.id,
           b.run_id as "runId",
           b.reference,
           b.status,
           r.service_date as "serviceDate",
           r.departure_at as "departureAt",
           b.travel_class as "travelClass",
           b.passenger_count as "passengerCount",
           b.from_stop_index as "fromStopIndex",
           b.to_stop_index as "toStopIndex",
           b.total_fare_paise as "totalFarePaise",
           t.code as "trainCode",
           t.name as "trainName",
           u.name as "passengerName",
           u.email as "passengerEmail",
           fs.code as "fromCode",
           ts.code as "toCode",
           coalesce((
             select string_agg(rc.coach_code || ' · ' || rs.seat_number, ', '
                               order by rc.position, rs.seat_number)
             from booking_seats bs
             join run_seats rs on rs.id = bs.run_seat_id
             join run_coaches rc on rc.id = rs.run_coach_id
             where bs.booking_id = b.id
           ), '') as "seatLabels"
      from bookings b
      join train_runs r on r.id = b.run_id
      join trains t on t.id = r.train_id
      join "user" u on u.id = b.user_id
      join routes rt on rt.id = t.route_id
      join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = b.from_stop_index
      join stations fs on fs.id = rfs.station_id
      join route_stops rts on rts.route_id = rt.id and rts.stop_index = b.to_stop_index
      join stations ts on ts.id = rts.station_id
     where ${where}
     order by r.departure_at desc, b.created_at desc
     limit ${limit}
  `)) as unknown as OperatorBookingRow[];
}

export type OperatorHoldRow = {
  id: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  passengerCount: number;
  travelClass: TravelClass;
  trainCode: string;
  trainName: string;
  passengerName: string;
  passengerEmail: string;
  fromCode: string;
  toCode: string;
  seatLabels: string;
};

const HOLD_SELECT = sql`
  select h.id,
         h.status,
         h.expires_at as "expiresAt",
         h.created_at as "createdAt",
         h.passenger_count as "passengerCount",
         h.travel_class as "travelClass",
         t.code as "trainCode",
         t.name as "trainName",
         u.name as "passengerName",
         u.email as "passengerEmail",
         fs.code as "fromCode",
         ts.code as "toCode",
         coalesce((
           select string_agg(rc.coach_code || ' · ' || rs.seat_number, ', '
                             order by rc.position, rs.seat_number)
           from hold_seats hs
           join run_seats rs on rs.id = hs.run_seat_id
           join run_coaches rc on rc.id = rs.run_coach_id
           where hs.hold_id = h.id
         ), '') as "seatLabels"
    from seat_holds h
    join train_runs r on r.id = h.run_id
    join trains t on t.id = r.train_id
    join "user" u on u.id = h.user_id
    join routes rt on rt.id = t.route_id
    join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = h.from_stop_index
    join stations fs on fs.id = rfs.station_id
    join route_stops rts on rts.route_id = rt.id and rts.stop_index = h.to_stop_index
    join stations ts on ts.id = rts.station_id
`;

export async function getOperatorHolds(
  trainIds: string[] | "all",
): Promise<OperatorHoldRow[]> {
  const scope = trainScope(trainIds);
  return (await getDb().execute(sql`
    ${HOLD_SELECT}
    where ${scope} and h.status = 'active' and h.expires_at > now()
    order by h.expires_at
    limit 50
  `)) as unknown as OperatorHoldRow[];
}

export async function getOperatorRunHolds(runId: string): Promise<OperatorHoldRow[]> {
  return (await getDb().execute(sql`
    ${HOLD_SELECT}
    where h.run_id = ${runId} and h.status = 'active' and h.expires_at > now()
    order by h.expires_at
  `)) as unknown as OperatorHoldRow[];
}

export type OperatorWaitlistRow = {
  id: string;
  status: string;
  priority: number;
  passengerCount: number;
  travelClass: TravelClass;
  createdAt: Date;
  trainCode: string;
  trainName: string;
  serviceDate: string;
  departureAt: Date;
  fromCode: string;
  toCode: string;
  passengerName: string;
  passengerEmail: string;
  offeredHoldId: string | null;
  offeredExpiresAt: Date | null;
};

export async function getOperatorWaitlist(
  trainIds: string[] | "all",
): Promise<OperatorWaitlistRow[]> {
  const scope = trainScope(trainIds);
  return (await getDb().execute(sql`
    select w.id,
           w.status,
           w.priority,
           w.passenger_count as "passengerCount",
           w.travel_class as "travelClass",
           w.created_at as "createdAt",
           t.code as "trainCode",
           t.name as "trainName",
           r.service_date as "serviceDate",
           r.departure_at as "departureAt",
           fs.code as "fromCode",
           ts.code as "toCode",
           u.name as "passengerName",
           u.email as "passengerEmail",
           w.offered_hold_id as "offeredHoldId",
           h.expires_at as "offeredExpiresAt"
      from waitlist_entries w
      join train_runs r on r.id = w.run_id
      join trains t on t.id = r.train_id
      join "user" u on u.id = w.user_id
      join routes rt on rt.id = t.route_id
      join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = w.from_stop_index
      join stations fs on fs.id = rfs.station_id
      join route_stops rts on rts.route_id = rt.id and rts.stop_index = w.to_stop_index
      join stations ts on ts.id = rts.station_id
      left join seat_holds h on h.id = w.offered_hold_id
     where ${scope}
     order by case
                when w.status = 'offered' then 0
                when w.status = 'waiting' then 1
                else 2
              end,
              w.priority desc,
              w.created_at asc
     limit 100
  `)) as unknown as OperatorWaitlistRow[];
}

export type OperatorDisruptionRow = {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  createdAt: Date;
  resolvedAt: Date | null;
  trainCode: string;
  trainName: string;
  serviceDate: string;
  runId: string;
  createdByName: string | null;
};

export async function getOperatorDisruptions(
  trainIds: string[] | "all",
): Promise<OperatorDisruptionRow[]> {
  const scope = trainScope(trainIds);
  return (await getDb().execute(sql`
    select d.id,
           d.title,
           d.description,
           d.severity,
           d.created_at as "createdAt",
           d.resolved_at as "resolvedAt",
           t.code as "trainCode",
           t.name as "trainName",
           r.service_date as "serviceDate",
           d.run_id as "runId",
           u.name as "createdByName"
      from disruptions d
      join train_runs r on r.id = d.run_id
      join trains t on t.id = r.train_id
      left join "user" u on u.id = d.created_by
     where ${scope}
     order by (d.resolved_at is null) desc, d.created_at desc
     limit 50
  `)) as unknown as OperatorDisruptionRow[];
}

export async function getOperatorRunDisruptions(
  runId: string,
): Promise<OperatorDisruptionRow[]> {
  return (await getDb().execute(sql`
    select d.id,
           d.title,
           d.description,
           d.severity,
           d.created_at as "createdAt",
           d.resolved_at as "resolvedAt",
           t.code as "trainCode",
           t.name as "trainName",
           r.service_date as "serviceDate",
           d.run_id as "runId",
           u.name as "createdByName"
      from disruptions d
      join train_runs r on r.id = d.run_id
      join trains t on t.id = r.train_id
      left join "user" u on u.id = d.created_by
     where d.run_id = ${runId}
     order by (d.resolved_at is null) desc, d.created_at desc
  `)) as unknown as OperatorDisruptionRow[];
}

export async function getOperatorRunBookings(
  runId: string,
): Promise<OperatorBookingRow[]> {
  return (await getDb().execute(sql`
    select b.id,
           b.run_id as "runId",
           b.reference,
           b.status,
           r.service_date as "serviceDate",
           r.departure_at as "departureAt",
           b.travel_class as "travelClass",
           b.passenger_count as "passengerCount",
           b.from_stop_index as "fromStopIndex",
           b.to_stop_index as "toStopIndex",
           b.total_fare_paise as "totalFarePaise",
           t.code as "trainCode",
           t.name as "trainName",
           u.name as "passengerName",
           u.email as "passengerEmail",
           fs.code as "fromCode",
           ts.code as "toCode",
           coalesce((
             select string_agg(rc.coach_code || ' · ' || rs.seat_number, ', '
                               order by rc.position, rs.seat_number)
             from booking_seats bs
             join run_seats rs on rs.id = bs.run_seat_id
             join run_coaches rc on rc.id = rs.run_coach_id
             where bs.booking_id = b.id
           ), '') as "seatLabels"
      from bookings b
      join train_runs r on r.id = b.run_id
      join trains t on t.id = r.train_id
      join "user" u on u.id = b.user_id
      join routes rt on rt.id = t.route_id
      join route_stops rfs on rfs.route_id = rt.id and rfs.stop_index = b.from_stop_index
      join stations fs on fs.id = rfs.station_id
      join route_stops rts on rts.route_id = rt.id and rts.stop_index = b.to_stop_index
      join stations ts on ts.id = rts.station_id
     where b.run_id = ${runId}
     order by b.created_at desc
  `)) as unknown as OperatorBookingRow[];
}

export type OperatorSeatOption = {
  id: string;
  coachCode: string;
  seatNumber: number;
  berthType: BerthType;
  isAccessible: boolean;
};

/** Seats free for one booking's exact leg, usable for controlled reassignment. */
export async function getAvailableSeatsForLeg(
  runId: string,
  travelClass: TravelClass,
  fromStopIndex: number,
  toStopIndex: number,
): Promise<OperatorSeatOption[]> {
  return (await getDb().execute(sql`
    select rs.id,
           rc.coach_code as "coachCode",
           rs.seat_number as "seatNumber",
           rs.berth_type as "berthType",
           rs.is_accessible as "isAccessible"
      from run_seats rs
      join run_coaches rc on rc.id = rs.run_coach_id
     where rc.run_id = ${runId}
       and rc.travel_class = ${travelClass}
       and not exists (
         select 1
           from seat_segment_claims c
           left join seat_holds h on h.id = c.hold_id
          where c.run_seat_id = rs.id
            and c.segment_index >= ${fromStopIndex}
            and c.segment_index < ${toStopIndex}
            and (c.booking_id is not null
                 or (c.hold_id is not null and h.status = 'active' and h.expires_at > now()))
       )
     order by rc.position, rs.seat_number
  `)) as unknown as OperatorSeatOption[];
}
