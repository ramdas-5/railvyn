/**
 * Builds railvyn-neon-setup.sql from db/fullschema.sql + db/seed.sql.
 *
 * The root file is pasted into the Neon SQL Editor, so it must contain no
 * psql-only meta-commands and no SET statements (Neon's "Explain" mode wraps a
 * script in EXPLAIN, which fails on SET). Part 1 drops and recreates the public
 * schema, which makes the whole file re-runnable.
 *
 * Usage: pnpm db:sql:bundle
 */
import { readFileSync, writeFileSync } from "node:fs";

const HEADER = `-- ===========================================================================
-- RAILVYN — one-file Neon PostgreSQL setup
--
-- RUN IT: Neon Console -> SQL Editor -> paste this whole file -> click "Run".
-- Do not click "Explain": EXPLAIN can only describe a single query and wraps
-- the script in one EXPLAIN, which fails on DDL/transaction statements (the
-- earlier "syntax error at or near \\"set\\"" came from that mode).
--
-- RE-RUNNABLE: Part 1 drops and recreates the public schema, deleting every
-- table in the public schema of the target database. Use a dedicated
-- demonstration database, never a database with data you want to keep.
--
-- PART 1 — schema: enums, tables, foreign keys, indexes, constraints
-- PART 2 — deterministic demo data: 63 stations, 16 routes, 30 trains,
--          300 runs, 59,700 seats, 100 bookings, waitlist + audit samples
--
-- Demo accounts (password for every seeded account: RailvynDemo#2026)
--   passenger@railvyn.demo    priya@railvyn.demo     kabir@railvyn.demo
--   operator@railvyn.demo     operator2@railvyn.demo
--   admin@railvyn.demo
--
-- After running: set NEON_DATABASE_URL (pooled connection string) and
-- BETTER_AUTH_SECRET, restart the app, then sign in as admin@railvyn.demo or
-- operator@railvyn.demo to reach the /admin and /operator portals.
--
-- Independent educational demo. Not IRCTC or Indian Railways, no official PNR,
-- simulated payments only. All train, station and booking data is synthetic.
--
-- File is ~7.3 MiB. If the SQL editor refuses it, apply Part 2 only with
-- \`pnpm db:seed\` (uses NEON_DATABASE_URL), or use
-- psql "$NEON_DATABASE_URL" -f railvyn-neon-setup.sql.
-- Do not also run Drizzle migrations on this database.
-- ===========================================================================
`;

const schema = readFileSync("db/fullschema.sql", "utf8").trim();
const seed = readFileSync("db/seed.sql", "utf8").trim();

const output = `${HEADER}
-- ===========================================================================
-- PART 1 — SCHEMA
-- ===========================================================================

${schema}

-- ===========================================================================
-- PART 2 — DEMONSTRATION DATA
-- ===========================================================================

${seed}
`;

writeFileSync("railvyn-neon-setup.sql", output, "utf8");
console.log(
  `[railvyn] wrote railvyn-neon-setup.sql (${(output.length / 1024 / 1024).toFixed(2)} MiB)`,
);
