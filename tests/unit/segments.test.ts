import { describe, expect, it } from "vitest";
import { claimIsLive, claimOverlaps, type ClaimRow } from "@/lib/domain/availability";

function claim(overrides: Partial<ClaimRow>): ClaimRow {
  return {
    runSeatId: "seat-1",
    segmentIndex: 0,
    holdId: null,
    bookingId: "booking-1",
    holdStatus: null,
    holdExpiresAt: null,
    ...overrides,
  };
}

describe("journey segment overlap", () => {
  it("treats a booking on [0,3) as overlapping segments 0, 1 and 2 only", () => {
    const booking = claim({ bookingId: "b1", segmentIndex: 2 });
    expect(claimOverlaps(booking, 0, 3)).toBe(true);
    expect(claimOverlaps(booking, 3, 7)).toBe(false);
  });

  it("allows a seat to be reused on a later non-overlapping leg", () => {
    const firstLeg = claim({ bookingId: "a", segmentIndex: 1 });
    expect(claimOverlaps(firstLeg, 2, 5)).toBe(false);
  });

  it("detects overlap in the middle of a long journey", () => {
    const middle = claim({ segmentIndex: 3 });
    expect(claimOverlaps(middle, 2, 6)).toBe(true);
    expect(claimOverlaps(middle, 4, 6)).toBe(false);
    expect(claimOverlaps(middle, 0, 3)).toBe(false);
  });

  it("ignores expired holds but counts live holds", () => {
    const expired = claim({
      bookingId: null,
      holdId: "h1",
      holdStatus: "active",
      holdExpiresAt: new Date(Date.now() - 60_000),
    });
    expect(claimIsLive(expired)).toBe(false);
    expect(claimOverlaps(expired, 0, 3)).toBe(false);

    const live = claim({
      bookingId: null,
      holdId: "h2",
      holdStatus: "active",
      holdExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(claimOverlaps(live, 0, 3)).toBe(true);
  });

  it("ignores claims belonging to released or expired holds", () => {
    const released = claim({
      bookingId: null,
      holdId: "h3",
      holdStatus: "released",
      holdExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(claimOverlaps(released, 0, 3)).toBe(false);
  });
});
