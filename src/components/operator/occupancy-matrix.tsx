import { cn } from "@/lib/utils";
import { TRAVEL_CLASS_SHORT } from "@/lib/utils";

export type MatrixCoach = {
  coachId: string;
  code: string;
  travelClass: string;
  capacity: number;
  segments: number[];
};

export function OccupancyMatrix({
  coaches,
  segmentLabels,
}: {
  coaches: MatrixCoach[];
  segmentLabels: string[];
}) {
  if (coaches.length === 0) {
    return (
      <p className="rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
        No coaches are attached to this run yet.
      </p>
    );
  }
  return (
    <div className="rv-scroll">
      <table className="w-full min-w-[38rem] border-separate border-spacing-1 text-left text-xs">
        <caption className="sr-only">
          Confirmed seat occupancy by coach and travel segment
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-24 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              Coach
            </th>
            {segmentLabels.map((label, index) => (
              <th
                key={label}
                scope="col"
                className="px-1 py-1 text-center text-[10px] font-semibold text-ink-muted"
              >
                <span className="rv-mono block">S{index}</span>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coaches.map((coach) => (
            <tr key={coach.coachId}>
              <th scope="row" className="rounded-[6px] bg-subtle px-2 py-2 text-left">
                <span className="block font-semibold">{coach.code}</span>
                <span className="text-[10px] font-normal text-ink-muted">
                  {TRAVEL_CLASS_SHORT[coach.travelClass as keyof typeof TRAVEL_CLASS_SHORT] ??
                    coach.travelClass}{" "}
                  · {coach.capacity}
                </span>
              </th>
              {coach.segments.map((booked, index) => {
                const pct =
                  coach.capacity > 0
                    ? Math.round((booked / coach.capacity) * 100)
                    : 0;
                return (
                  <td key={index} className="p-0">
                    <span
                      title={`${coach.code}, segment ${segmentLabels[index] ?? index}: ${booked} of ${coach.capacity} seats booked (${pct}%)`}
                      className={cn(
                        "flex min-h-11 items-center justify-center rounded-[6px] border text-[11px] font-semibold",
                        pct === 0
                          ? "border-line-light/70 bg-subtle/60 text-ink-muted"
                          : pct < 50
                            ? "border-accent-ink/15 bg-accent/45 text-accent-ink"
                            : pct < 85
                              ? "border-warning-ink/20 bg-warning text-warning-ink"
                              : "border-danger-ink/20 bg-danger text-danger-ink",
                      )}
                    >
                      {booked}
                      <span className="ml-1 text-[9px] font-medium opacity-80">
                        {pct}%
                      </span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-ink-muted">
        Confirmed bookings only. Each cell is seats claimed for that half-open
        segment. A seat may legitimately appear on non-overlapping cells.
      </p>
    </div>
  );
}
