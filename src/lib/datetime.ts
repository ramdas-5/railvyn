export const APP_TIMEZONE = "Asia/Kolkata";

function partsInZone(date: Date, timeZone = APP_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    weekday: get("weekday"),
  };
}

/** "Sat, 07 Nov" in the app timezone. */
export function formatDate(date: Date | string, timeZone = APP_TIMEZONE): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(value);
}

/** "Sat, 07 Nov 2026" in the app timezone. */
export function formatFullDate(date: Date | string, timeZone = APP_TIMEZONE): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

/** "06:10" in the app timezone. */
export function formatTime(date: Date | string, timeZone = APP_TIMEZONE): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

/** "06:10, 07 Nov 2026" in the app timezone. */
export function formatDateTime(date: Date | string, timeZone = APP_TIMEZONE): string {
  return `${formatTime(date, timeZone)}, ${new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date)}`;
}

/** "7h 35m" from minutes. */
export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** YYYY-MM-DD for "today" in Asia/Kolkata. */
export function todayInAppZone(now = new Date()): string {
  const p = partsInZone(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Adds whole days to a YYYY-MM-DD service date. */
export function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Converts a service date plus a local Asia/Kolkata offset (minutes from
 * midnight) into a UTC instant. Timestamps are stored in UTC everywhere.
 */
export function kolkataToUtc(serviceDate: string, offsetMinutes: number): Date {
  const [y, m, d] = serviceDate.split("-").map(Number);
  const midnightUtc = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0);
  const IST_OFFSET_MINUTES = 330; // UTC+05:30, no DST
  return new Date(midnightUtc + (offsetMinutes - IST_OFFSET_MINUTES) * 60_000);
}

/** Milliseconds remaining, floored at zero. */
export function msRemaining(expiresAt: Date | string, now = new Date()): number {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Math.max(0, expiry.getTime() - now.getTime());
}

/** mm:ss countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function isoDateToDisplay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatFullDate(new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 6, 30)));
}
