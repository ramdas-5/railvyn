import Link from "next/link";
import { ArrowLeftRight, CalendarDays, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";

export type StationOption = { id: string; code: string; name: string; city: string };

export function SearchForm({
  stations,
  defaults,
  tone = "light",
  compact = false,
}: {
  stations: StationOption[];
  defaults?: {
    from?: string;
    to?: string;
    date?: string;
    travelClass?: string;
    passengers?: string;
  };
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const labelClass = tone === "dark" ? "rv-label-dark" : "rv-label";
  const fieldVariant = tone === "dark" ? "dark" : "light";

  return (
    <form
      action="/search"
      method="get"
      className={
        tone === "dark"
          ? "rounded-feature border border-line bg-raised p-5 sm:p-6"
          : "rv-feature p-5 sm:p-6"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Plan a journey</p>
        <p className="text-xs text-ink-muted">
          Segment-accurate availability · demo fares
        </p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_1fr]">
        <div>
          <label htmlFor="from" className={labelClass}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success-ink/70" aria-hidden="true" />
              From
            </span>
          </label>
          <Select id="from" name="from" required defaultValue={defaults?.from ?? ""} variant={fieldVariant}>
            <option value="" disabled>
              Boarding station
            </option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.code} — {station.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="to" className={labelClass}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-danger-ink/60" aria-hidden="true" />
              To
            </span>
          </label>
          <Select id="to" name="to" required defaultValue={defaults?.to ?? ""} variant={fieldVariant}>
            <option value="" disabled>
              Alighting station
            </option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.code} — {station.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:pt-0">
          <label htmlFor="date" className={labelClass}>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              Date
            </span>
          </label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={defaults?.date}
            variant={fieldVariant}
            className="md:w-[10.5rem]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="travelClass" className={labelClass}>
              Class
            </label>
            <Select
              id="travelClass"
              name="travelClass"
              defaultValue={defaults?.travelClass ?? "any"}
              variant={fieldVariant}
            >
              <option value="any">Any class</option>
              {Object.entries(TRAVEL_CLASS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="passengers" className={labelClass}>
              <span className="inline-flex items-center gap-1.5">
                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                Seats
              </span>
            </label>
            <Select
              id="passengers"
              name="passengers"
              defaultValue={defaults?.passengers ?? "1"}
              variant={fieldVariant}
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <ArrowLeftRight aria-hidden="true" className="h-3.5 w-3.5" />
          Seats are allocated per leg, not for the entire run.
        </p>
        <Button type="submit" className="w-full sm:w-auto">
          <Search aria-hidden="true" className="h-4 w-4" />
          Search trains
        </Button>
      </div>
      {!compact ? (
        <p className="mt-3 text-[11px] text-ink-muted">
          Demonstration timetable. Not official Indian Railways inventory.{" "}
          <Link href="/search" className="underline underline-offset-2">
            Browse all departures
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
