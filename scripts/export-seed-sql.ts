/**
 * Exports the currently seeded RAILVYN database to db/seed.sql.
 *
 * The SQL file is intended to be applied after db/fullschema.sql on a fresh
 * PostgreSQL/Neon database. It truncates application tables first and reinserts
 * deterministic demo data, including Better Auth users with the documented
 * demo password hash.
 *
 * Usage: pnpm db:sql:export
 */
import { writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const connectionString = process.env.NEON_DATABASE_URL ?? "";
if (!connectionString) {
  console.error(
    "[railvyn] NEON_DATABASE_URL is required to export the SQL seed.",
  );
  process.exit(1);
}

/**
 * Parent tables appear before children so every foreign key is satisfiable
 * without disabling constraints. Auth session/verification rows are excluded.
 */
const TABLES = [
  "user",
  "account",
  "stations",
  "routes",
  "route_stops",
  "trains",
  "train_runs",
  "coach_templates",
  "template_seats",
  "run_coaches",
  "run_seats",
  "role_assignments",
  "operator_scopes",
  "fares",
  "bookings",
  "booking_passengers",
  "booking_seats",
  "seat_holds",
  "hold_seats",
  "seat_segment_claims",
  "waitlist_entries",
  "payments_demo",
  "disruptions",
  "audit_logs",
  "app_settings",
] as const;

const TRUNCATE_TABLES = [
  "audit_logs",
  "disruptions",
  "payments_demo",
  "waitlist_entries",
  "seat_segment_claims",
  "hold_seats",
  "seat_holds",
  "booking_seats",
  "booking_passengers",
  "bookings",
  "fares",
  "run_seats",
  "run_coaches",
  "template_seats",
  "coach_templates",
  "train_runs",
  "operator_scopes",
  "trains",
  "role_assignments",
  "route_stops",
  "routes",
  "stations",
  "app_settings",
  "verification",
  "account",
  "session",
  "user",
] as const;

type ColumnRow = { columnName: string; dataType: string };

function sqlLiteral(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return "NULL";
  if (dataType === "jsonb" || dataType === "json") {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  }
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main() {
  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  const counts: Record<string, number> = {};
  const blocks: string[] = [];

  try {
    for (const table of TABLES) {
      const columns = await client<ColumnRow[]>`
        select column_name as "columnName", data_type as "dataType"
        from information_schema.columns
        where table_schema = 'public' and table_name = ${table}
        order by ordinal_position
      `;
      if (columns.length === 0) {
        throw new Error(`Table ${table} does not exist in the configured database.`);
      }

      const rows = await client.unsafe<Record<string, unknown>[]>(
        `select * from ${quoteIdent(table)}`,
      );
      counts[table] = rows.length;
      if (rows.length === 0) continue;

      const columnList = columns
        .map((column) => quoteIdent(column.columnName))
        .join(", ");
      const batchSize = 250;
      for (let start = 0; start < rows.length; start += batchSize) {
        const batch = rows.slice(start, start + batchSize);
        const values = batch
          .map(
            (row) =>
              `(${columns
                .map((column) =>
                  sqlLiteral(row[column.columnName], column.dataType),
                )
                .join(", ")})`,
          )
          .join(",\n");
        blocks.push(
          `insert into ${quoteIdent(table)} (${columnList}) values\n${values};`,
        );
      }
    }

    const summary = TABLES.filter((table) => counts[table] > 0)
      .map((table) => `--   ${table}: ${counts[table]}`)
      .join("\n");

    const header = `-- ---------------------------------------------------------------------------
-- RAILVYN demonstration seed (PostgreSQL / Neon)
-- Generated from the deterministic seed via: pnpm db:sql:export
-- Apply AFTER db/fullschema.sql on a fresh database.
--
-- WARNING: this truncates all RAILVYN application tables.
-- Demo password for every seeded account: RailvynDemo#2026
-- Seat reuse example: coach S1 seat 42 on the next 12451 run, NDLS→CNB
-- and CNB→HWH booked by different passengers.
--
-- Row counts:
${summary}
-- ---------------------------------------------------------------------------

begin;

truncate table
${TRUNCATE_TABLES.map((table) => `  ${quoteIdent(table)}`).join(",\n")}
restart identity cascade;

${blocks.join("\n\n")}

commit;
`;

    writeFileSync("db/seed.sql", header, "utf8");
    console.log("[railvyn] wrote db/seed.sql");
    for (const table of TABLES) {
      if (counts[table] > 0) {
        console.log(`  ${table}: ${counts[table]}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[railvyn] SQL seed export failed", error);
  process.exit(1);
});
