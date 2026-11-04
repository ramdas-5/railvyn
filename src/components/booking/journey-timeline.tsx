import { ArrowRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime } from "@/lib/datetime";
import type { JourneyStop } from "@/lib/domain/availability";

export function JourneyTimeline({
  stops,
  departureAt,
  fromStopIndex,
  toStopIndex,
}: {
  stops: JourneyStop[];
  departureAt: Date;
  fromStopIndex: number;
  toStopIndex: number;
}) {
  const base = new Date(departureAt).getTime();
  const selected = stops.filter(
    (stop) => stop.stopIndex >= fromStopIndex && stop.stopIndex <= toStopIndex,
  );

  return (
    <div className="rv-scroll pb-2">
      <ol className="flex min-w-max items-start gap-0">
        {selected.map((stop, index) => {
          const isOrigin = stop.stopIndex === fromStopIndex;
          const isDestination = stop.stopIndex === toStopIndex;
          const time = formatTime(new Date(base + stop.offsetMinutes * 60_000));
          const next = selected[index + 1];
          const legMinutes = next ? next.offsetMinutes - stop.offsetMinutes : 0;
          return (
            <li key={stop.stopIndex} className="flex items-start">
              <div className="w-[8.5rem] sm:w-[10rem]">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full border",
                      isOrigin
                        ? "border-accent-ink bg-accent text-accent-ink"
                        : isDestination
                          ? "border-danger-ink/40 bg-danger text-danger-ink"
                          : "border-line-light bg-panel text-ink-muted",
                    )}
                  >
                    <MapPin className="h-2.5 w-2.5" />
                  </span>
                  <span
                    className={cn(
                      "rv-mono text-sm font-semibold",
                      isOrigin || isDestination ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {time}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-2 text-sm leading-snug",
                    isOrigin || isDestination ? "font-semibold text-ink" : "text-ink-muted",
                  )}
                >
                  {stop.code}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{stop.name}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted/80">
                  {stop.distanceKm} km
                </p>
                {isOrigin ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                    Boarding
                  </p>
                ) : null}
                {isDestination ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-danger-ink">
                    Alighting
                  </p>
                ) : null}
              </div>
              {next ? (
                <div className="flex w-[4.5rem] flex-col items-center px-1 pt-2 sm:w-[6rem]">
                  <div className="rv-rail-line h-0.5 w-full" aria-hidden="true" />
                  <span className="mt-1.5 whitespace-nowrap text-[10px] text-ink-muted">
                    {formatDuration(legMinutes)}
                  </span>
                  <span className="whitespace-nowrap text-[10px] text-ink-muted/70">
                    +{next.distanceKm - stop.distanceKm} km
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
        Times shown in Asia/Kolkata. Segment boundaries define which seats can be
        reused. <ArrowRight aria-hidden="true" className="h-3 w-3" />{" "}
        {selected[selected.length - 1]?.distanceKm ?? 0} km total route length in this
        view.
      </p>
    </div>
  );
}

export function JourneyMiniSummary({
  fromCode,
  toCode,
  fromTime,
  toTime,
  durationMinutes,
  className,
}: {
  fromCode: string;
  toCode: string;
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-2 text-sm", className)}>
      <span className="rv-mono text-lg font-semibold">{fromTime}</span>
      <span className="font-semibold">{fromCode}</span>
      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 self-center text-ink-muted" />
      <span className="rv-mono text-lg font-semibold">{toTime}</span>
      <span className="font-semibold">{toCode}</span>
      <span className="text-xs text-ink-muted">{formatDuration(durationMinutes)}</span>
    </p>
  );
}
