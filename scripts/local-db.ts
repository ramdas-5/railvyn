/**
 * Starts a real PostgreSQL server locally using the embedded-postgres binaries.
 *
 * This is a development convenience only. Production uses Neon PostgreSQL via
 * NEON_DATABASE_URL. Run in one terminal:  pnpm db:local
 * Then in another:                     pnpm db:migrate && pnpm db:seed && pnpm dev
 */
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = path.join(process.cwd(), ".data", "pg");
const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);
const PASSWORD = process.env.LOCAL_DB_PASSWORD ?? "postgres";

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // Recreate the symlinks PostgreSQL needs if npm/pnpm skipped build scripts.
    autoRehydrateSymlinks: true,
  });

  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log(`[railvyn] initialising PostgreSQL cluster at ${DATA_DIR}`);
    await pg.initialise();
  }

  await pg.start();
  console.log(`[railvyn] PostgreSQL listening on 127.0.0.1:${PORT}`);

  for (const database of ["railvyn", "railvyn_test"]) {
    try {
      await pg.createDatabase(database);
      console.log(`[railvyn] created database ${database}`);
    } catch {
      console.log(`[railvyn] database ${database} already exists`);
    }
  }

  console.log(
    "\n[railvyn] Local database ready.\n" +
      `  NEON_DATABASE_URL=postgresql://postgres:${PASSWORD}@localhost:${PORT}/railvyn\n` +
      "  Keep this process running. Press Ctrl+C to stop.\n",
  );

  const shutdown = async () => {
    console.log("\n[railvyn] stopping local PostgreSQL…");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive while PostgreSQL runs.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("[railvyn] failed to start local PostgreSQL", error);
  process.exit(1);
});
