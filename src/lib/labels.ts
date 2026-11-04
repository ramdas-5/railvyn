import type { BerthType } from "@/db/schema";

const BERTH_LABELS: Record<BerthType, string> = {
  lower: "Lower berth",
  middle: "Middle berth",
  upper: "Upper berth",
  side_lower: "Side lower",
  side_upper: "Side upper",
  seat: "Chair",
};

/** Shared display label used by both the coach map and readable list. */
export function berthedLabel(berth: BerthType): string {
  return BERTH_LABELS[berth] ?? berth;
}
