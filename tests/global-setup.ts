import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env.test", quiet: true, override: true });
loadEnv({ path: ".env", quiet: true });

export default async function globalSetup() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    console.warn(
      "[railvyn tests] NEON_DATABASE_URL is not set — database integration tests will be skipped.",
    );
    return;
  }

  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}
