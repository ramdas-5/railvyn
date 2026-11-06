/**
 * Applies db/bulk-seed.sql to the configured database.
 *
 * The bulk file adds 1,000+ stations/routes/trains/runs and 184,000 generated
 * seats on top of the base seed. It is one SQL script so PostgreSQL expands the
 * generate_series rows server-side in a single round trip.
 *
 * Usage: pnpm db:seed:bulk (after pnpm db:seed)
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error("[railvyn] NEON_DATABASE_URL is required to seed bulk data.");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const bulkSql = readFileSync("db/bulk-seed.sql", "utf8");
    console.log(`[railvyn] applying bulk seed (${(bulkSql.length / 1024).toFixed(1)} KiB)`);
    const started = Date.now();
    await sql.unsafe(bulkSql);
    console.log(`[railvyn] bulk seed applied in ${Math.round((Date.now() - started) / 1000)}s`);

    const [counts] = await sql<{
      stations: number;
      routes: number;
      trains: number;
      runs: number;
      seats: number;
      fares: number;
      users: number;
      bookings: number;
      claims: number;
      waitlist: number;
      disruptions: number;
      audit: number;
    }[]>`
      select
        (select count(*)::int from stations) as stations,
        (select count(*)::int from routes) as routes,
        (select count(*)::int from trains) as trains,
        (select count(*)::int from train_runs) as runs,
        (select count(*)::int from run_seats) as seats,
        (select count(*)::int from fares) as fares,
        (select count(*)::int from "user") as users,
        (select count(*)::int from bookings) as bookings,
        (select count(*)::int from seat_segment_claims) as claims,
        (select count(*)::int from waitlist_entries) as waitlist,
        (select count(*)::int from disruptions) as disruptions,
        (select count(*)::int from audit_logs) as audit
    `;
    console.log("[railvyn] totals:", counts);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("[railvyn] bulk seed failed", error);
  process.exit(1);
});
