import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

export type Policies = {
  holdTtlSeconds: number;
  waitlistOfferTtlSeconds: number;
  maxSeatsPerBooking: number;
  allowWaitlist: boolean;
};

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

const DEFAULTS: Policies = {
  holdTtlSeconds: envInt("HOLD_TTL_SECONDS", 300, 60, 1800),
  waitlistOfferTtlSeconds: envInt("WAITLIST_OFFER_TTL_SECONDS", 600, 120, 3600),
  maxSeatsPerBooking: envInt("MAX_SEATS_PER_BOOKING", 6, 1, 12),
  allowWaitlist: true,
};

/**
 * Operational policy is configurable by admins (app_settings) with environment
 * defaults. Values are clamped so a bad setting cannot break booking safety.
 */
export async function getPolicies(): Promise<Policies> {
  try {
    const rows = await getDb().select().from(appSettings);
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const clamp = (value: unknown, fallback: number, min: number, max: number) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    };
    return {
      holdTtlSeconds: clamp(map.get("holdTtlSeconds"), DEFAULTS.holdTtlSeconds, 60, 1800),
      waitlistOfferTtlSeconds: clamp(
        map.get("waitlistOfferTtlSeconds"),
        DEFAULTS.waitlistOfferTtlSeconds,
        120,
        3600,
      ),
      maxSeatsPerBooking: clamp(
        map.get("maxSeatsPerBooking"),
        DEFAULTS.maxSeatsPerBooking,
        1,
        12,
      ),
      allowWaitlist:
        typeof map.get("allowWaitlist") === "boolean"
          ? (map.get("allowWaitlist") as boolean)
          : DEFAULTS.allowWaitlist,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function savePolicy(
  key: keyof Policies,
  value: unknown,
): Promise<void> {
  await getDb()
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getPolicyRow(key: string) {
  const [row] = await getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row;
}
