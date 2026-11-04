import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  Clock,
  Info,
  Route as RouteIcon,
  TriangleAlert,
} from "lucide-react";
import {
  getClassAvailability,
  getRunDetails,
} from "@/lib/domain/availability";
import { getFarePaise } from "@/lib/domain/fare";
import { formatDate, formatDuration, formatTime } from "@/lib/datetime";
import { formatInr, TRAVEL_CLASS_LABELS, TRAVEL_CLASS_SHORT } from "@/lib/utils";
import { JourneyTimeline } from "@/components/booking/journey-timeline";
import { JoinWaitlistForm } from "@/components/booking/join-waitlist-form";
import { Badge, DemoNotice, EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { travelClassSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  try {
    const { runId } = await params;
    const details = await getRunDetails(runId);
    return { title: `${details.train.name} · ${details.train.code}` };
  } catch {
    return { title: "Train run" };
  }
}

function num(value: string | string[] | undefined, fallback = 0): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function RunDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { runId } = await params;
  const query = await searchParams;
  let details;
  try {
    details = await getRunDetails(runId);
  } catch {
    notFound();
  }

  const lastIndex = details.stops.length - 1;
  const from = Math.min(Math.max(0, num(query.from, 0)), lastIndex - 1);
  const to = Math.min(Math.max(from + 1, num(query.to, lastIndex)), lastIndex);
  const requestedClass = travelClassSchema.safeParse(
    Array.isArray(query.travelClass) ? query.travelClass[0] : query.travelClass,
  );
  const passengers = Math.max(1, Math.min(6, num(query.passengers, 1)));

  const availability = await getClassAvailability(runId, from, to);
  const fromStop = details.stops[from]!;
  const toStop = details.stops[to]!;
  const duration = toStop.offsetMinutes - fromStop.offsetMinutes;
  const arrival = new Date(
    new Date(details.run.departureAt).getTime() + duration * 60_000,
  );

  const classes = await Promise.all(
    availability.map(async (entry) => {
      let farePaise: number | null = null;
      try {
        farePaise = await getFarePaise(details.route.id, entry.travelClass, from, to);
      } catch {
        farePaise = null;
      }
      return { ...entry, farePaise };
    }),
  );

  const cancelled = details.run.status === "cancelled";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-muted">
        <Link href="/search" className="hover:text-ink">
          Search
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span aria-current="page">{details.train.code}</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{details.train.code}</Badge>
            <Badge tone="neutral">{details.route.name}</Badge>
            {details.run.status === "disrupted" ? (
              <Badge tone="warning" dot>
                Disrupted
              </Badge>
            ) : details.run.status === "cancelled" ? (
              <Badge tone="danger" dot>
                Cancelled
              </Badge>
            ) : (
              <Badge tone="success" dot>
                Scheduled
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{details.train.name}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {formatDate(details.run.departureAt)} · departs{" "}
            {formatTime(details.run.departureAt)} from {details.stops[0]?.code} ·{" "}
            {formatDuration(
              details.stops[lastIndex]!.offsetMinutes - details.stops[0]!.offsetMinutes,
            )}{" "}
            end to end
          </p>
        </div>
        {!cancelled ? (
          <Button asChild>
            <Link
              href={{
                pathname: `/book/${runId}/seats`,
                query: { from, to, travelClass: requestedClass.success ? requestedClass.data : classes[0]?.travelClass ?? "sleeper", passengers },
              }}
            >
              <Armchair aria-hidden="true" className="h-4 w-4" />
              Open coach map
            </Link>
          </Button>
        ) : null}
      </div>

      {details.run.notes ? (
        <div className="mt-5">
          {cancelled ? (
            <div role="alert" className="flex gap-3 rounded-small border border-danger-ink/20 bg-danger p-4 text-sm text-danger-ink">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">This run is cancelled</p>
                <p>{details.run.notes}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-small border border-warning-ink/25 bg-warning p-4 text-sm text-warning-ink">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Operational note</p>
                <p>{details.run.notes}</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Panel className="p-5 sm:p-6">
            <PanelHeader
              title="Journey timeline"
              description={`${fromStop.code} → ${toStop.code} · ${duration} minutes · ${toStop.distanceKm - fromStop.distanceKm} km`}
              icon={<RouteIcon className="h-4 w-4" />}
              action={
                <div className="text-right">
                  <p className="rv-mono text-lg font-semibold">
                    {formatTime(details.run.departureAt)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatTime(arrival)}
                  </p>
                </div>
              }
            />
            <div className="mt-6">
              <JourneyTimeline
                stops={details.stops}
                departureAt={details.run.departureAt}
                fromStopIndex={from}
                toStopIndex={to}
              />
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <PanelHeader
              title="Choose a class"
              description="Availability below counts physical seats with no live claim anywhere in your segment range."
              icon={<Armchair className="h-4 w-4" />}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {classes.map((entry) => {
                const selectable = entry.availableSeats >= passengers && !cancelled;
                return (
                  <div
                    key={entry.travelClass}
                    className="flex flex-col rounded-small border border-line-light bg-white/55 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {TRAVEL_CLASS_LABELS[entry.travelClass]}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {TRAVEL_CLASS_SHORT[entry.travelClass]} ·{" "}
                          {entry.totalSeats} seats in composition
                        </p>
                      </div>
                      <Badge tone={entry.availableSeats > 0 ? "success" : "warning"}>
                        {entry.availableSeats} free
                      </Badge>
                    </div>
                    <p className="rv-mono mt-3 text-xl font-semibold">
                      {entry.farePaise === null ? "—" : formatInr(entry.farePaise)}
                      <span className="ml-1 text-xs font-normal text-ink-muted">/ passenger</span>
                    </p>
                    <div className="mt-auto pt-3">
                      {entry.farePaise === null ? (
                        <p className="text-xs text-danger-ink">
                          No fare configured for this pair.
                        </p>
                      ) : selectable ? (
                        <Link
                          href={{
                            pathname: `/book/${runId}/seats`,
                            query: { from, to, travelClass: entry.travelClass, passengers },
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-accent-ink px-3 text-xs font-semibold text-accent hover:bg-[#31451c]"
                        >
                          Inspect coach
                          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <div>
                          <p className="mb-2 text-xs text-ink-muted">
                            {cancelled
                              ? "Booking closed for this run."
                              : `Needs ${passengers} seats; ${entry.availableSeats} free for this leg.`}
                          </p>
                          {!cancelled ? (
                            <JoinWaitlistForm
                              runId={runId}
                              from={from}
                              to={to}
                              travelClass={entry.travelClass}
                              passengerCount={passengers}
                            />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {classes.length === 0 ? (
              <EmptyState
                title="No classes configured"
                description="This run has no coach inventory yet. An administrator can add coaches and fares."
                icon={<Info className="h-5 w-5" />}
              />
            ) : null}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Train composition
            </p>
            <ul className="mt-3 space-y-2">
              {details.coaches.map((coach) => (
                <li
                  key={coach.id}
                  className="flex items-center justify-between gap-2 rounded-chip border border-line-light/80 bg-white/40 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-[6px] bg-subtle text-xs">
                      {coach.code}
                    </span>
                    {TRAVEL_CLASS_LABELS[coach.travelClass]}
                  </span>
                  <span className="rv-mono text-xs text-ink-muted">
                    {coach.seats.length} seats
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-ink-muted">
              Composition is per dated run, not a global template. Adding or
              removing a booked coach is blocked.
            </p>
          </Panel>

          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              At a glance
            </p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5 text-ink-muted">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" /> Travel time
                </dt>
                <dd className="font-semibold">{formatDuration(duration)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Distance</dt>
                <dd className="rv-mono font-semibold">
                  {toStop.distanceKm - fromStop.distanceKm} km
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Service date</dt>
                <dd className="font-semibold">{formatDate(details.run.departureAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">Segments used</dt>
                <dd className="rv-mono font-semibold">
                  {from}–{to - 1}
                </dd>
              </div>
            </dl>
            <Link
              href={`/search`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline underline-offset-2"
            >
              Back to search
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </Panel>

          <Panel className="p-5">
            <DemoNotice />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              Availability refreshes from the server and is revalidated again when
              a hold is created. This page is not a live railway feed.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
