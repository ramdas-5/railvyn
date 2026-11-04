import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export class DatabaseNotConfiguredError extends Error {
  code = "DATABASE_NOT_CONFIGURED";
  constructor() {
    super(
      "No NEON_DATABASE_URL is configured. Set it in .env.local (see .env.example) and run migrations.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export type Database = PostgresJsDatabase<typeof schema>;
export type DbTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
export type DbExecutor = Database | DbTransaction;

type DbGlobals = {
  __railvynSql?: ReturnType<typeof postgres>;
  __railvynDb?: Database;
};

const globals = globalThis as unknown as DbGlobals;

/**
 * Lazily creates the database connection so that public pages can render (and
 * the production build can succeed) even when NEON_DATABASE_URL is not configured.
 * Data-dependent features fail with an explicit, honest error instead.
 */
export function getDb(): Database {
  if (globals.__railvynDb) return globals.__railvynDb;

  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();

  const client =
    globals.__railvynSql ??
    postgres(url, {
      // Required for Neon's transaction pooler; harmless for direct connections.
      prepare: false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  globals.__railvynSql = client;

  const database = drizzle(client, { schema });
  globals.__railvynDb = database;
  return database;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL);
}

export function getSqlClient() {
  getDb();
  return globals.__railvynSql!;
}

export { schema };
