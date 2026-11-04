import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats integer paise as Indian rupees, e.g. 148350 -> "₹1,483.50". */
export function formatInr(paise: number, opts?: { withPaise?: boolean }): string {
  const withPaise = opts?.withPaise ?? false;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  }).format(paise / 100);
}

export const TRAVEL_CLASS_LABELS = {
  sleeper: "Sleeper",
  ac3: "AC 3 Tier",
  ac2: "AC 2 Tier",
  chair: "Chair Car",
} as const;

export const TRAVEL_CLASS_SHORT = {
  sleeper: "SL",
  ac3: "3A",
  ac2: "2A",
  chair: "CC",
} as const;

export const BERTH_LABELS = {
  lower: "Lower berth",
  middle: "Middle berth",
  upper: "Upper berth",
  side_lower: "Side lower",
  side_upper: "Side upper",
  seat: "Chair",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  active: "Held",
  converted: "Converted",
  expired: "Expired",
  released: "Released",
  waiting: "Waiting",
  offered: "Offered",
  scheduled: "Scheduled",
  disrupted: "Disrupted",
  completed: "Completed",
  succeeded: "Paid (demo)",
  refunded: "Refunded (demo)",
};

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
