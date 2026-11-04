import { describe, expect, it } from "vitest";
import { rankAndSelectSeats, type RankableSeat } from "@/lib/domain/allocation";

function seat(
  id: string,
  seatNumber: number,
  rowIndex: number,
  positionInRow: number,
  overrides: Partial<RankableSeat> = {},
): RankableSeat {
  return {
    id,
    coachId: "coach-1",
    coachCode: "S1",
    coachPosition: 1,
    seatNumber,
    berthType: "lower",
    rowIndex,
    positionInRow,
    isAccessible: false,
    ...overrides,
  };
}

const seats: RankableSeat[] = [
  seat("s1", 1, 1, 1),
  seat("s2", 2, 1, 2, { berthType: "upper" }),
  seat("s3", 3, 2, 1),
  seat("s4", 4, 2, 2, { berthType: "upper" }),
  seat("s5", 5, 3, 1, { isAccessible: true }),
  seat("s6", 6, 3, 2, { berthType: "side_lower" }),
];

describe("seat ranking", () => {
  it("honours a berth preference when feasible", () => {
    const picked = rankAndSelectSeats(seats, 1, { berthType: "upper" });
    expect(picked).toHaveLength(1);
    expect(picked[0]!.berthType).toBe("upper");
  });

  it("selects exactly the requested number of distinct seats", () => {
    const picked = rankAndSelectSeats(seats, 4);
    expect(new Set(picked.map((entry) => entry.id)).size).toBe(4);
  });

  it("prefers adjacent seats in the same coach for groups", () => {
    const picked = rankAndSelectSeats(seats, 2, { preferAdjacent: true });
    expect(picked[0]!.coachId).toBe(picked[1]!.coachId);
    expect(Math.abs(picked[0]!.rowIndex - picked[1]!.rowIndex)).toBeLessThanOrEqual(1);
  });

  it("filters to accessible seats when accessibility is required", () => {
    expect(rankAndSelectSeats(seats, 1, { accessibleOnly: true })[0]!.isAccessible).toBe(true);
  });

  it("returns no allocation when demand exceeds availability (all-or-nothing)", () => {
    expect(rankAndSelectSeats(seats.slice(0, 2), 3)).toEqual([]);
  });

  it("is deterministic for identical inputs", () => {
    const first = rankAndSelectSeats(seats, 3).map((entry) => entry.id);
    const second = rankAndSelectSeats([...seats].reverse(), 3).map((entry) => entry.id);
    expect(first).toEqual(second);
  });
});
