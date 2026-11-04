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
  runs: number;
  seats: number;
  bookings: number;
  claims: number;
  waitlist: number;
  reusedSeats: number;
  overlappingClaims: number;
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
    console.log(
      `[railvyn] applying fullschema.sql (${(schemaSql.length / 1024).toFixed(1)} KiB)`,
    );
    await target.unsafe(schemaSql);
    console.log(
      `[railvyn] applying seed.sql (${(seedSql.length / 1024 / 1024).toFixed(2)} MiB)`,
    );
    await target.unsafe(seedSql);

    const rows = await target.unsafe<Counts[]>(`
      select
        (select count(*)::int from information_schema.tables where table_schema = 'public') as "tables",
        (select count(*)::int from "user") as "users",
        (select count(*)::int from train_runs) as "runs",
        (select count(*)::int from run_seats) as "seats",
        (select count(*)::int from bookings) as "bookings",
        (select count(*)::int from seat_segment_claims) as "claims",
        (select count(*)::int from waitlist_entries) as "waitlist",
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
        ) as "overlappingClaims"
    `);

    const counts = rows[0]!;
    console.log("[railvyn] SQL verification counts:", counts);

    const failures: string[] = [];
    if (counts.tables < 27) failures.push(`expected 27+ tables, got ${counts.tables}`);
    if (counts.users !== 6) failures.push(`expected 6 demo users, got ${counts.users}`);
    if (counts.runs < 30) failures.push(`expected 30+ runs, got ${counts.runs}`);
    if (counts.seats < 5_000) failures.push(`expected 5000+ run seats, got ${counts.seats}`);
    if (counts.bookings !== 8) failures.push(`expected 8 demo bookings, got ${counts.bookings}`);
    if (counts.claims <= 0) failures.push("expected confirmed segment claims");
    if (counts.waitlist < 2) failures.push(`expected 2 waitlist entries, got ${counts.waitlist}`);
    if (counts.reusedSeats < 1) failures.push("expected at least one reused physical seat");
    if (counts.overlappingClaims !== 0) {
      failures.push(`found ${counts.overlappingClaims} overlapping claims`);
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
