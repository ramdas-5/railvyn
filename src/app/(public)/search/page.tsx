import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Armchair, CalendarDays, Info, SearchX, TrainFront } from "lucide-react";
import {
  getStations,
  searchJourneys,
  type JourneySearchResult,
} from "@/lib/domain/availability";
import { addDaysToIsoDate, formatDate, formatDuration, formatTime, todayInAppZone } from "@/lib/datetime";
import { toUserMessage } from "@/lib/errors";
import { formatInr, TRAVEL_CLASS_LABELS, TRAVEL_CLASS_SHORT } from "@/lib/utils";
import { SearchForm } from "@/components/booking/search-form";
import { DatabaseNotice } from "@/components/database-notice";
import { Badge, EmptyState, Panel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { travelClassSchema } from "@/lib/validation";
import type { TravelClass } from "@/db/schema";

export const metadata: Metadata = { title: "Search trains" };
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function ResultCard({ result }: { result: JourneySearchResult }) {
  const departureTime = formatTime(result.departureAt);
  const arrivalTime = formatTime(
    new Date(new Date(result.departureAt).getTime() + result.durationMinutes * 60_000),
  );
  return (
    <Panel className="overflow-hidden p-0">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{result.trainCode}</Badge>
            <h2 className="text-lg font-semibold">{result.trainName}</h2>
            <span className="text-xs text-ink-muted">{result.routeName}</span>
            {result.status === "disrupted" ? (
              <Badge tone="warning">Disruption flagged</Badge>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="rv-mono text-2xl font-semibold">
                {formatTime(result.departureAt)}
              </p>
              <p className="text-xs font-semibold">{result.fromStop.code}</p>
              <p className="text-xs text-ink-muted">{result.fromStop.name}</p>
            </div>
            <div className="flex min-w-[7rem] flex-col items-center text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              <span>{formatDuration(result.durationMinutes)}</span>
              <div className="rv-rail-line mt-1.5 h-0.5 w-full min-w-16" aria-hidden="true" />
              <span className="mt-1.5">Direct · {result.distanceKm} km</span>
            </div>
            <div>
              <p className="rv-mono text-2xl font-semibold">{arrivalTime}</p>
              <p className="text-xs font-semibold">{result.toStop.code}</p>
              <p className="text-xs text-ink-muted">{result.toStop.name}</p>
            </div>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
            {formatDate(result.departureAt)} · boarding {result.fromStop.code}, alighting{" "}
            {result.toStop.code}. Availability is for this exact leg.
          </p>
        </div>
        <div className="w-full border-t border-line-light pt-4 lg:w-[22rem] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Available classes
          </p>
          <ul className="mt-2 space-y-2">
            {result.classes.map((entry) => (
              <li
                key={entry.travelClass}
                className="flex flex-wrap items-center justify-between gap-2 rounded-small border border-line-light/80 bg-white/50 p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {TRAVEL_CLASS_LABELS[entry.travelClass]}{" "}
                    <span className="text-xs font-normal text-ink-muted">
                      {TRAVEL_CLASS_SHORT[entry.travelClass]}
                    </span>
                  </p>
                  <p className="rv-mono mt-0.5 text-xs text-ink-muted">
                    {formatInr(entry.farePaise)} · {entry.availableSeats}/{entry.totalSeats}{" "}
                    free
                  </p>
                </div>
                <Link
                  href={{
                    pathname: `/trains/${result.runId}`,
                    query: {
                      from: result.fromStop.stopIndex,
                      to: result.toStop.stopIndex,
                      travelClass: entry.travelClass,
                    },
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-accent px-3 text-xs font-semibold text-accent-ink hover:bg-[#e7ffa8]"
                >
                  <Armchair aria-hidden="true" className="h-3.5 w-3.5" />
                  Select seats
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let stations: Awaited<ReturnType<typeof getStations>> = [];
  try {
    stations = await getStations();
  } catch {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <DatabaseNotice />
      </div>
    );
  }

  const from = first(params.from);
  const to = first(params.to);
  const date = first(params.date) ?? addDaysToIsoDate(todayInAppZone(), 1);
  const classParam = first(params.travelClass) ?? "any";
  const passengers = Number(first(params.passengers) ?? 1) || 1;
  const travelClass = travelClassSchema.safeParse(classParam);

  let results: JourneySearchResult[] = [];
  let error: string | null = null;
  const attempted = Boolean(from && to && first(params.date));

  if (from && to) {
    try {
      results = await searchJourneys({
        fromStationId: from,
        toStationId: to,
        serviceDate: date,
        travelClass: travelClass.success ? (travelClass.data as TravelClass) : "any",
        passengers,
      });
    } catch (caught) {
      error = toUserMessage(caught);
    }
  }

  const fromStation = stations.find((station) => station.id === from);
  const toStation = stations.find((station) => station.id === to);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Journey search
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold">
            {fromStation && toStation
              ? `${fromStation.code} → ${toStation.code}`
              : "Find a demonstration departure"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Seats are calculated for the exact boarding and alighting stations you
            choose. A berth occupied beyond your stop does not block your leg.
          </p>

          <div className="mt-6">
            <SearchForm
              stations={stations}
              defaults={{
                from,
                to,
                date,
                travelClass: classParam,
                passengers: String(passengers),
              }}
            />
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {attempted ? "Departures" : "Ready when you are"}
              </h2>
              {attempted ? (
                <p className="text-xs text-ink-muted">
                  {results.length} run{results.length === 1 ? "" : "s"} ·{" "}
                  {formatDate(date)}
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="mt-4">
                <EmptyState
                  title="That search could not run"
                  description={error}
                  icon={<Info className="h-5 w-5" />}
                />
              </div>
            ) : !attempted ? (
              <div className="mt-4">
                <EmptyState
                  title="Choose a boarding and alighting station"
                  description="Pick a pair on the same demonstration route. New Delhi → Howrah and Mumbai → Chennai have seeded departures for the next two weeks."
                  icon={<TrainFront className="h-5 w-5" />}
                />
              </div>
            ) : results.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No seats for that combination"
                  description="Try another date, class or station pair. Runs with fewer free seats than passengers are hidden; joining a waitlist is available from a run's page."
                  icon={<SearchX className="h-5 w-5" />}
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/search">Reset search</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {results.map((result) => (
                  <ResultCard key={result.runId} result={result} />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Reading the results
            </p>
            <ul className="mt-3 space-y-3 text-xs leading-relaxed text-ink-muted">
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success-ink" aria-hidden="true" />
                Availability is specific to your segment range, not the whole train.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning-ink" aria-hidden="true" />
                Fares are deterministic seeded rules per route, class and station pair.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rail" aria-hidden="true" />
                The server revalidates everything again when you place a hold.
              </li>
            </ul>
          </Panel>
          <Panel className="p-5">
            <p className="text-xs font-semibold">Short on seats?</p>
            <p className="mt-1 text-xs text-ink-muted">
              Open a run to join its waitlist. Offers are FIFO within an explicit
              priority category and expire if not confirmed.
            </p>
            <Link
              href="/my-bookings"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline underline-offset-2"
            >
              View existing bookings
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
