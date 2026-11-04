import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env.test", quiet: true, override: true });
loadEnv({ path: ".env", quiet: true });

if (!process.env.NEON_DATABASE_URL) {
  console.warn(
    "[railvyn tests] NEON_DATABASE_URL is not set. Database integration tests will be skipped.",
  );
}
