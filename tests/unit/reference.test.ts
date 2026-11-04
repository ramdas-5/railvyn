import { describe, expect, it } from "vitest";
import {
  BOOKING_REFERENCE_PATTERN,
  generateBookingReference,
  generateIdempotencyKey,
} from "@/lib/domain/reference";
import { calculateTotalFare } from "@/lib/domain/fare";
import { formatCountdown, kolkataToUtc } from "@/lib/datetime";
import { formatInr } from "@/lib/utils";

describe("RAILVYN booking references", () => {
  it("generates unambiguous internal references, never official PNRs", () => {
    for (let i = 0; i < 50; i += 1) {
      const reference = generateBookingReference();
      expect(reference).toMatch(BOOKING_REFERENCE_PATTERN);
      expect(reference.startsWith("RVN-")).toBe(true);
      expect(reference).not.toMatch(/[OI01]/);
    }
  });

  it("creates unique idempotency keys", () => {
    const keys = new Set(Array.from({ length: 500 }, () => generateIdempotencyKey("hold")));
    expect(keys.size).toBe(500);
    expect([...keys][0]).toMatch(/^hold_/);
  });
});

describe("fares and formatting", () => {
  it("multiplies the per-passenger fare by passenger count", () => {
    expect(calculateTotalFare(148_350, 3)).toBe(445_050);
  });

  it("formats INR from paise", () => {
    expect(formatInr(148_350)).toContain("1,484");
    expect(formatInr(50_000)).toContain("500");
  });

  it("formats countdowns safely at zero", () => {
    expect(formatCountdown(299_000)).toBe("04:59");
    expect(formatCountdown(-500)).toBe("00:00");
  });

  it("converts Asia/Kolkata service times to UTC without DST drift", () => {
    // 06:10 IST on 2026-11-04 is 00:40 UTC.
    expect(kolkataToUtc("2026-11-04", 370).toISOString()).toBe(
      "2026-11-04T00:40:00.000Z",
    );
  });
});
