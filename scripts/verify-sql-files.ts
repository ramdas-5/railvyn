/**
 * Verifies db/fullschema.sql and db/seed.sql end-to-end on a scratch database.
 *
 * Safety: this only runs against a loopback PostgreSQL host. Set
 * RAILVYN_ALLOW_REMOTE_SQL_VERIFY=1 only if you truly intend to create and drop
 * a database on a remote server. It never touches the configured database.
 *
 * Usage: pnpm db:sql:verify
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const configured = process.env.NEON_DATABASE_URL;
if (!configured) {
  console.error("[railvyn] NEON_DATABASE_URL is required to verify the SQL files.");
  process.exit(1);
}

const parsed = new URL(configured);
const loopback = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!loopback.has(parsed.hostname) && process.env.RAILVYN_ALLOW_REMOTE_SQL_VERIFY !== "1") {
  console.error(
    `[railvyn] refusing to create/drop a scratch database on ${parsed.hostname}. ` +
      "Use a local NEON_DATABASE_URL or set RAILVYN_ALLOW_REMOTE_SQL_VERIFY=1.",
  );
  process.exit(1);
}

const SCRATCH_DB = "railvyn_sqlcheck";
const adminUrl = new URL(configured);
adminUrl.pathname = "/postgres";
const scratchUrl = new URL(configured);
scratchUrl.pathname = `/${SCRATCH_DB}`;

type Counts = {
  tables: number;
  users: number;
  stations: number;
  routes: number;
  trains: number;
  runs: number;
  seats: number;
  fares: number;
  bookings: number;
  claims: number;
  waitlist: number;
  disruptions: number;
  audit: number;
  reusedSeats: number;
  overlappingClaims: number;
  duplicateStations: number;
  duplicateWaitlist: number;
  duplicateAudit: number;
  coveredDates: number;
  coveredPairs: number;
  allPairs: number;
};

async function main() {
  const admin = postgres(adminUrl.toString(), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  let target: ReturnType<typeof postgres> | null = null;

  try {
    await admin.unsafe(`drop database if exists "${SCRATCH_DB}" with (force)`);
    await admin.unsafe(
      `create database "${SCRATCH_DB}" with template template0 encoding 'UTF8' lc_collate 'C' lc_ctype 'C'`,
    );
    console.log(`[railvyn] created scratch database ${SCRATCH_DB}`);

    target = postgres(scratchUrl.toString(), {
      max: 1,
      prepare: false,
      onnotice: () => {},
    });

    const schemaSql = readFileSync("db/fullschema.sql", "utf8");
    const seedSql = readFileSync("db/seed.sql", "utf8");
    const bulkSql = readFileSync("db/bulk-seed.sql", "utf8");
    console.log(
      `[railvyn] applying fullschema.sql (${(schemaSql.length / 1024).toFixed(1)} KiB)`,
    );
    await target.unsafe(schemaSql);
    console.log(
      `[railvyn] applying seed.sql (${(seedSql.length / 1024 / 1024).toFixed(2)} MiB)`,
    );
    await target.unsafe(seedSql);
    console.log(
      `[railvyn] applying bulk-seed.sql (${(bulkSql.length / 1024).toFixed(1)} KiB)`,
    );
    await target.unsafe(bulkSql);

    const rows = await target.unsafe<Counts[]>(`
      select
        (select count(*)::int from information_schema.tables where table_schema = 'public') as "tables",
        (select count(*)::int from "user") as "users",
        (select count(*)::int from stations) as "stations",
        (select count(*)::int from routes) as "routes",
        (select count(*)::int from trains) as "trains",
        (select count(*)::int from train_runs) as "runs",
        (select count(*)::int from run_seats) as "seats",
        (select count(*)::int from fares) as "fares",
        (select count(*)::int from bookings) as "bookings",
        (select count(*)::int from seat_segment_claims) as "claims",
        (select count(*)::int from waitlist_entries) as "waitlist",
        (select count(*)::int from disruptions) as "disruptions",
        (select count(*)::int from audit_logs) as "audit",
        (
          select count(*)::int from (
            select rs.id
            from seat_segment_claims c
            join run_seats rs on rs.id = c.run_seat_id
            where c.booking_id is not null
            group by rs.id
            having count(distinct c.booking_id) > 1
          ) reused
        ) as "reusedSeats",
        (
          select count(*)::int from (
            select run_seat_id, segment_index
            from seat_segment_claims
            group by run_seat_id, segment_index
            having count(*) > 1
          ) overlapping
        ) as "overlappingClaims",
        (
          select count(*)::int from (
            select name, city from stations
            group by name, city having count(*) > 1
          ) dup
        ) as "duplicateStations",
        (
          select count(*)::int from (
            select run_id, user_id, from_stop_index, to_stop_index, travel_class
            from waitlist_entries
            group by run_id, user_id, from_stop_index, to_stop_index, travel_class
            having count(*) > 1
          ) dup
        ) as "duplicateWaitlist",
        (
          select count(*)::int from (
            select action, entity_type, entity_id, metadata, created_at
            from audit_logs
            group by action, entity_type, entity_id, metadata, created_at
            having count(*) > 1
          ) dup
        ) as "duplicateAudit",
        (
          select count(*)::int from (
            select service_date
            from train_runs
            where service_date between (now() at time zone 'Asia/Kolkata')::date
              and (now() at time zone 'Asia/Kolkata')::date + 6
            group by service_date
            having count(*) >= 1000
          ) covered
        ) as "coveredDates",
        (
          select count(*)::int from (
            select distinct a.station_id, b.station_id
            from route_stops a
            join route_stops b
              on a.route_id = b.route_id and a.stop_index < b.stop_index
          ) pairs
        ) as "coveredPairs",
        (select (count(*) * (count(*) - 1))::int from stations) as "allPairs"
    `);

    const counts = rows[0]!;
    console.log("[railvyn] SQL verification counts:", counts);

    const failures: string[] = [];
    if (counts.tables < 27) failures.push(`expected 27+ tables, got ${counts.tables}`);
    if (counts.users < 1000) failures.push(`expected 1000+ users, got ${counts.users}`);
    if (counts.stations < 1000) failures.push(`expected 1000+ stations, got ${counts.stations}`);
    if (counts.routes < 1000) failures.push(`expected 1000+ routes, got ${counts.routes}`);
    if (counts.trains < 1000) failures.push(`expected 1000+ trains, got ${counts.trains}`);
    if (counts.runs < 7000) failures.push(`expected 7000+ runs (daily service), got ${counts.runs}`);
    if (counts.seats < 900_000) failures.push(`expected 900000+ run seats, got ${counts.seats}`);
    if (counts.coveredDates !== 7) {
      failures.push(
        `expected all 7 upcoming dates to have 1000+ departures, got ${counts.coveredDates}`,
      );
    }
    if (counts.coveredPairs !== counts.allPairs) {
      failures.push(
        `only ${counts.coveredPairs}/${counts.allPairs} ordered station pairs share a route`,
      );
    }
    if (counts.fares < 1000) failures.push(`expected 1000+ fares, got ${counts.fares}`);
    if (counts.bookings < 1000) failures.push(`expected 1000+ bookings, got ${counts.bookings}`);
    if (counts.claims <= 0) failures.push("expected confirmed segment claims");
    if (counts.waitlist < 1000) failures.push(`expected 1000+ waitlist entries, got ${counts.waitlist}`);
    if (counts.disruptions < 1000) failures.push(`expected 1000+ disruptions, got ${counts.disruptions}`);
    if (counts.audit < 1000) failures.push(`expected 1000+ audit rows, got ${counts.audit}`);
    if (counts.reusedSeats < 1) failures.push("expected at least one reused physical seat");
    if (counts.overlappingClaims !== 0) {
      failures.push(`found ${counts.overlappingClaims} overlapping claims`);
    }
    if (counts.duplicateStations !== 0) {
      failures.push(`found ${counts.duplicateStations} duplicate station name/city pairs`);
    }
    if (counts.duplicateWaitlist !== 0) {
      failures.push(`found ${counts.duplicateWaitlist} duplicate waitlist requests`);
    }
    if (counts.duplicateAudit !== 0) {
      failures.push(`found ${counts.duplicateAudit} duplicate audit rows`);
    }

    if (failures.length > 0) {
      throw new Error(`SQL verification failed:\n- ${failures.join("\n- ")}`);
    }
    console.log(
      "[railvyn] SQL files verified: schema, seed, no overlapping claims, seat reuse preserved.",
    );
  } finally {
    if (target) await target.end();
    try {
      await admin.unsafe(`drop database if exists "${SCRATCH_DB}" with (force)`);
      console.log(`[railvyn] dropped scratch database ${SCRATCH_DB}`);
    } finally {
      await admin.end();
    }
  }
}

main().catch((error) => {
  console.error("[railvyn] SQL verification failed", error);
  process.exit(1);
});
