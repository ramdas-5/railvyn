import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error(
      "[railvyn] No NEON_DATABASE_URL configured. Copy .env.example to .env.local and set your Neon connection string.",
    );
    process.exit(1);
  }

  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(client, {});
  console.log("[railvyn] applying migrations from ./drizzle …");
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.end();
  console.log("[railvyn] migrations applied.");
}

main().catch((error) => {
  console.error("[railvyn] migration failed", error);
  process.exit(1);
});
