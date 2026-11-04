import { ArrowRight, MapPin, Ticket } from "lucide-react";
import { formatFullDate, formatTime } from "@/lib/datetime";
import { formatInr, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { berthedLabel } from "@/lib/labels";
import { Badge } from "@/components/ui/surfaces";
import type { BerthType, TravelClass } from "@/db/schema";

export type SummarySeat = {
  coachCode: string;
  seatNumber: number;
  berthType: BerthType;
  isAccessible?: boolean;
};

export function TripSummary({
  trainName,
  trainCode,
  departureAt,
  fromCode,
  fromName,
  toCode,
  toName,
  travelClass,
  seats,
  farePerPassengerPaise,
  passengerCount,
  totalFarePaise,
  status,
  reference,
}: {
  trainName: string;
  trainCode: string;
  departureAt: Date | string;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  travelClass: TravelClass;
  seats: SummarySeat[];
  farePerPassengerPaise: number;
  passengerCount: number;
  totalFarePaise: number;
  status?: "held" | "confirmed" | "cancelled";
  reference?: string;
}) {
  const date = typeof departureAt === "string" ? new Date(departureAt) : departureAt;
  return (
    <div className="rounded-card border border-line-light bg-panel p-5 text-ink">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {trainCode} · {formatFullDate(date)}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{trainName}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {reference ? <Badge tone="accent">{reference}</Badge> : null}
          {status ? (
            <Badge tone={status === "confirmed" ? "success" : status === "held" ? "warning" : "danger"}>
              {status === "confirmed" ? "Confirmed" : status === "held" ? "Held" : "Cancelled"}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <p className="rv-mono text-2xl font-semibold">{formatTime(date)}</p>
          <p className="flex items-center gap-1 text-xs font-semibold">
            <MapPin aria-hidden="true" className="h-3 w-3" />
            {fromCode}
          </p>
          <p className="text-xs text-ink-muted">{fromName}</p>
        </div>
        <ArrowRight aria-hidden="true" className="h-4 w-4 text-ink-muted" />
        <div>
          <p className="text-xs font-semibold">{toCode}</p>
          <p className="text-xs text-ink-muted">{toName}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">
            {TRAVEL_CLASS_LABELS[travelClass]}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-line-light pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
          Seats
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {seats.map((seat) => (
            <li
              key={`${seat.coachCode}-${seat.seatNumber}`}
              className="flex items-center gap-1.5 rounded-chip border border-line-light bg-white/60 px-2.5 py-1.5 text-xs"
            >
              <Ticket aria-hidden="true" className="h-3 w-3 text-ink-muted" />
              <span className="font-semibold">
                {seat.coachCode} · {seat.seatNumber}
              </span>
              <span className="text-ink-muted">{berthedLabel(seat.berthType)}</span>
              {seat.isAccessible ? <span className="text-[10px]">Accessible</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-4 grid gap-2 border-t border-line-light pt-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Fare / passenger</dt>
          <dd className="rv-mono font-semibold">{formatInr(farePerPassengerPaise)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Passengers</dt>
          <dd className="rv-mono font-semibold">{passengerCount}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Demo total</dt>
          <dd className="rv-mono text-sm font-semibold">{formatInr(totalFarePaise)}</dd>
        </div>
      </dl>
    </div>
  );
}
