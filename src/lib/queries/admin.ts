import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { BerthType, RunStatus, TravelClass } from "@/db/schema";

export type AdminStation = {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  timezone: string;
};

export async function getAdminStations(): Promise<AdminStation[]> {
  return (await getDb().execute(sql`
    select id, code, name, city, state, timezone
      from stations
     order by code
  `)) as unknown as AdminStation[];
}

export type AdminRouteStop = {
  stopIndex: number;
  stationId: string;
  code: string;
  name: string;
  distanceKm: number;
  offsetMinutes: number;
};

export type AdminRoute = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stops: AdminRouteStop[];
};

export async function getAdminRoutes(): Promise<AdminRoute[]> {
  const routes = (await getDb().execute(sql`
    select id, code, name, description
      from routes
     order by code
  `)) as unknown as Array<Omit<AdminRoute, "stops">>;

  const stops = (await getDb().execute(sql`
    select rs.route_id as "routeId",
           rs.stop_index as "stopIndex",
           rs.station_id as "stationId",
           s.code,
           s.name,
           rs.distance_km as "distanceKm",
           rs.scheduled_offset_minutes as "offsetMinutes"
      from route_stops rs
      join stations s on s.id = rs.station_id
     order by rs.route_id, rs.stop_index
  `)) as unknown as Array<AdminRouteStop & { routeId: string }>;

  return routes.map((route) => ({
    ...route,
    stops: stops
      .filter((stop) => stop.routeId === route.id)
      .map((stop) => ({
        stopIndex: stop.stopIndex,
        stationId: stop.stationId,
        code: stop.code,
        name: stop.name,
        distanceKm: stop.distanceKm,
        offsetMinutes: stop.offsetMinutes,
      })),
  }));
}

export type AdminTrain = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  routeId: string;
  routeCode: string;
  routeName: string;
  stopCount: number;
  runs: number;
};

export async function getAdminTrains(): Promise<AdminTrain[]> {
  return (await getDb().execute(sql`
    select t.id,
           t.code,
           t.name,
           t.active,
           r.id as "routeId",
           r.code as "routeCode",
           r.name as "routeName",
           (select count(*)::int from route_stops rs where rs.route_id = t.route_id) as "stopCount",
           (select count(*)::int from train_runs tr where tr.train_id = t.id) as "runs"
      from trains t
      join routes r on r.id = t.route_id
     order by t.code
  `)) as unknown as AdminTrain[];
}

export type AdminRunRow = {
  id: string;
  serviceDate: string;
  departureAt: Date;
  arrivalAt: Date;
  status: RunStatus;
  trainId: string;
  trainCode: string;
  trainName: string;
  routeCode: string;
  coaches: number;
  capacity: number;
  bookings: number;
  activeHolds: number;
};

export async function getAdminRuns(limit = 80): Promise<AdminRunRow[]> {
  return (await getDb().execute(sql`
    select r.id,
           r.service_date as "serviceDate",
           r.departure_at as "departureAt",
           r.arrival_at as "arrivalAt",
           r.status,
           t.id as "trainId",
           t.code as "trainCode",
           t.name as "trainName",
           rt.code as "routeCode",
           (select count(*)::int from run_coaches rc where rc.run_id = r.id) as coaches,
           (select count(*)::int
              from run_seats rs join run_coaches rc on rc.id = rs.run_coach_id
             where rc.run_id = r.id) as capacity,
           (select count(*)::int from bookings b
             where b.run_id = r.id and b.status = 'confirmed') as bookings,
           (select count(*)::int from seat_holds h
             where h.run_id = r.id and h.status = 'active' and h.expires_at > now()) as "activeHolds"
      from train_runs r
      join trains t on t.id = r.train_id
      join routes rt on rt.id = t.route_id
     order by r.departure_at desc
     limit ${limit}
  `)) as unknown as AdminRunRow[];
}

export type AdminRunCoach = {
  id: string;
  coachCode: string;
  position: number;
  travelClass: TravelClass;
  templateCode: string;
  templateName: string;
  seats: number;
  claimCount: number;
  bookedSeats: number;
};

export type AdminRunDetail = {
  run: {
    id: string;
    serviceDate: string;
    departureAt: Date;
    arrivalAt: Date;
    status: RunStatus;
    notes: string | null;
    trainId: string;
    trainCode: string;
    trainName: string;
    routeId: string;
    routeCode: string;
    routeName: string;
  };
  stops: Array<{
    stopIndex: number;
    code: string;
    name: string;
    offsetMinutes: number;
    distanceKm: number;
  }>;
  coaches: AdminRunCoach[];
};

export async function getAdminRunDetail(runId: string): Promise<AdminRunDetail | null> {
  const runs = (await getDb().execute(sql`
    select r.id,
           r.service_date as "serviceDate",
           r.departure_at as "departureAt",
           r.arrival_at as "arrivalAt",
           r.status,
           r.notes,
           t.id as "trainId",
           t.code as "trainCode",
           t.name as "trainName",
           rt.id as "routeId",
           rt.code as "routeCode",
           rt.name as "routeName"
      from train_runs r
      join trains t on t.id = r.train_id
      join routes rt on rt.id = t.route_id
     where r.id = ${runId}
     limit 1
  `)) as unknown as Array<AdminRunDetail["run"]>;
  const run = runs[0];
  if (!run) return null;

  const stops = (await getDb().execute(sql`
    select rs.stop_index as "stopIndex",
           s.code,
           s.name,
           rs.scheduled_offset_minutes as "offsetMinutes",
           rs.distance_km as "distanceKm"
      from route_stops rs
      join stations s on s.id = rs.station_id
     where rs.route_id = ${run.routeId}
     order by rs.stop_index
  `)) as unknown as AdminRunDetail["stops"];

  const coaches = (await getDb().execute(sql`
    select rc.id,
           rc.coach_code as "coachCode",
           rc.position,
           rc.travel_class as "travelClass",
           ct.code as "templateCode",
           ct.name as "templateName",
           (select count(*)::int from run_seats rs where rs.run_coach_id = rc.id) as seats,
           (select count(*)::int from seat_segment_claims c
              join run_seats rs on rs.id = c.run_seat_id
             where rs.run_coach_id = rc.id) as "claimCount",
           (select count(distinct c.run_seat_id)::int from seat_segment_claims c
              join run_seats rs on rs.id = c.run_seat_id
             where rs.run_coach_id = rc.id and c.booking_id is not null) as "bookedSeats"
      from run_coaches rc
      join coach_templates ct on ct.id = rc.template_id
     where rc.run_id = ${runId}
     order by rc.position
  `)) as unknown as AdminRunCoach[];

  return { run, stops, coaches };
}

export type AdminCoachTemplate = {
  id: string;
  code: string;
  name: string;
  travelClass: TravelClass;
  layoutStyle: string;
  totalSeats: number;
  berthTypes: string;
  runUsages: number;
};

export async function getAdminCoachTemplates(): Promise<AdminCoachTemplate[]> {
  return (await getDb().execute(sql`
    select ct.id,
           ct.code,
           ct.name,
           ct.travel_class as "travelClass",
           ct.layout_style as "layoutStyle",
           ct.total_seats as "totalSeats",
           coalesce((select string_agg(distinct ts.berth_type::text, ', ')
                       from template_seats ts where ts.template_id = ct.id), '') as "berthTypes",
           (select count(*)::int from run_coaches rc where rc.template_id = ct.id) as "runUsages"
      from coach_templates ct
     order by ct.code
  `)) as unknown as AdminCoachTemplate[];
}

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  roles: string[];
  scopes: Array<{ trainId: string; code: string; name: string }>;
  confirmedBookings: number;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  const rows = (await getDb().execute(sql`
    select u.id,
           u.name,
           u.email,
           u.created_at as "createdAt",
           coalesce((select json_agg(ra.role order by ra.role)
                       from role_assignments ra where ra.user_id = u.id), '[]'::json) as roles,
           (select count(*)::int from bookings b
             where b.user_id = u.id and b.status = 'confirmed') as "confirmedBookings",
           coalesce((select json_agg(json_build_object('trainId', os.train_id, 'code', t.code, 'name', t.name)
                                     order by t.code)
                       from operator_scopes os
                       join trains t on t.id = os.train_id
                      where os.user_id = u.id), '[]'::json) as scopes
      from "user" u
     order by u.created_at asc
     limit 200
  `)) as unknown as Array<Omit<AdminUserRow, "roles" | "scopes"> & {
    roles: string[] | null;
    scopes: AdminUserRow["scopes"] | null;
  }>;
  return rows.map((row) => ({
    ...row,
    roles: row.roles ?? [],
    scopes: row.scopes ?? [],
  }));
}

export type AdminFareRow = {
  id: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  travelClass: TravelClass;
  fromStopIndex: number;
  toStopIndex: number;
  fromCode: string;
  toCode: string;
  amountPaise: number;
  updatedAt: Date;
};

export async function getAdminFares(): Promise<AdminFareRow[]> {
  return (await getDb().execute(sql`
    select f.id,
           f.route_id as "routeId",
           r.code as "routeCode",
           r.name as "routeName",
           f.travel_class as "travelClass",
           f.from_stop_index as "fromStopIndex",
           f.to_stop_index as "toStopIndex",
           fs.code as "fromCode",
           ts.code as "toCode",
           f.amount_paise as "amountPaise",
           f.updated_at as "updatedAt"
      from fares f
      join routes r on r.id = f.route_id
      join route_stops rfs on rfs.route_id = r.id and rfs.stop_index = f.from_stop_index
      join stations fs on fs.id = rfs.station_id
      join route_stops rts on rts.route_id = r.id and rts.stop_index = f.to_stop_index
      join stations ts on ts.id = rts.station_id
     order by r.code, f.travel_class, f.from_stop_index, f.to_stop_index
  `)) as unknown as AdminFareRow[];
}

export type AdminAuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorRole: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export async function getAdminAudit(
  query = "",
  limit = 100,
): Promise<AdminAuditRow[]> {
  const trimmed = query.trim();
  const like = `%${trimmed}%`;
  return (await getDb().execute(sql`
    select a.id,
           a.action,
           a.entity_type as "entityType",
           a.entity_id as "entityId",
           a.actor_role as "actorRole",
           a.metadata,
           a.created_at as "createdAt",
           u.name as "actorName",
           u.email as "actorEmail"
      from audit_logs a
      left join "user" u on u.id = a.actor_user_id
     where ${trimmed === "" ? sql`true` : sql`(
       a.action ilike ${like}
       or a.entity_type ilike ${like}
       or coalesce(a.entity_id, '') ilike ${like}
       or coalesce(u.name, '') ilike ${like}
       or coalesce(u.email, '') ilike ${like}
     )`}
     order by a.created_at desc
     limit ${limit}
  `)) as unknown as AdminAuditRow[];
}

export type AdminSeatForReassign = {
  id: string;
  coachCode: string;
  seatNumber: number;
  berthType: BerthType;
  isAccessible: boolean;
};
