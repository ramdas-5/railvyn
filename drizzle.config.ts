import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local development overrides when present (never committed).
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.NEON_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5433/railvyn",
  },
  strict: true,
  verbose: true,
});
