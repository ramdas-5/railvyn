import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Info, TriangleAlert } from "lucide-react";
import { getSeatMapForLeg } from "@/lib/domain/availability";
import { getFarePaise } from "@/lib/domain/fare";
import { getSessionUser } from "@/lib/auth";
import { formatDate, formatTime } from "@/lib/datetime";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { travelClassSchema } from "@/lib/validation";
import { SeatSelector } from "@/components/booking/seat-selector";
import { JoinWaitlistForm } from "@/components/booking/join-waitlist-form";
import { DatabaseNotice } from "@/components/database-notice";
import { Alert, Badge, Panel } from "@/components/ui/surfaces";
import { EmptyState } from "@/components/ui/surfaces";
import { Armchair } from "lucide-react";

export const metadata: Metadata = { title: "Select seats" };
export const dynamic = "force-dynamic";

function num(value: string | string[] | undefined, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function SeatSelectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { runId } = await params;
  const query = await searchParams;
  const from = num(query.from, 0);
  const to = num(query.to, 0);
  const passengers = Math.max(1, Math.min(6, num(query.passengers, 1)));
  const classResult = travelClassSchema.safeParse(
    Array.isArray(query.travelClass) ? query.travelClass[0] : query.travelClass,
  );

  if (!classResult.success || from >= to) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Choose a journey first"
          description="The coach map needs a boarding stop, alighting stop, class and passenger count. Start from a run's page."
          icon={<Armchair className="h-5 w-5" />}
        />
        <p className="mt-4 text-center text-sm">
          <Link href={`/trains/${runId}`} className="text-accent underline underline-offset-2">
            Open the run details
          </Link>
        </p>
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof getSeatMapForLeg>>;
  try {
    data = await getSeatMapForLeg(runId, from, to, classResult.data);
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <DatabaseNotice />
        <p className="mt-4 text-center text-sm text-ink-muted">
          <Link href={`/trains/${runId}`} className="underline underline-offset-2">
            Return to the run
          </Link>
        </p>
      </div>
    );
  }

  let farePerPassengerPaise: number;
  try {
    farePerPassengerPaise = await getFarePaise(
      data.details.route.id,
      classResult.data,
      from,
      to,
    );
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Alert tone="warning" title="No fare configured">
          This class and station pair has no fare rule. Choose another class or ask
          an administrator to add pricing.
        </Alert>
      </div>
    );
  }

  const session = await getSessionUser();
  const fromStop = data.details.stops[from];
  const toStop = data.details.stops[to];
  if (!fromStop || !toStop) notFound();

  const nextPath = `/book/${runId}/seats?from=${from}&to=${to}&travelClass=${classResult.data}&passengers=${passengers}`;
  const soldOut = data.classAvailability.availableSeats < passengers;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-muted">
        <Link href="/search" className="hover:text-ink">
          Search
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <Link href={`/trains/${runId}?from=${from}&to=${to}`} className="hover:text-ink">
          {data.details.train.code}
        </Link>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span aria-current="page">Select seats</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{data.details.train.code}</Badge>
            <Badge tone="neutral">{TRAVEL_CLASS_LABELS[classResult.data]}</Badge>
            <Badge tone={soldOut ? "warning" : "success"} dot>
              {data.classAvailability.availableSeats} of {data.classAvailability.totalSeats} free
            </Badge>
          </p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            {fromStop.code} → {toStop.code}, choose your berths
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {data.details.train.name} · {formatDate(data.details.run.departureAt)} ·{" "}
            {formatTime(data.details.run.departureAt)} departure · segments {from}–
            {to - 1}
          </p>
        </div>
        <Link
          href={`/trains/${runId}?from=${from}&to=${to}&travelClass=${classResult.data}&passengers=${passengers}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-chip border border-line px-3 text-xs font-semibold text-fg hover:border-rail"
        >
          Change class
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Boarding", `${fromStop.code} · ${formatTime(new Date(new Date(data.details.run.departureAt).getTime() + fromStop.offsetMinutes * 60_000))}`],
          ["Alighting", `${toStop.code} · ${formatTime(new Date(new Date(data.details.run.departureAt).getTime() + toStop.offsetMinutes * 60_000))}`],
          ["Hold window", "5 minutes · server-validated"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-small border border-line bg-raised px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
              {label}
            </p>
            <p className="rv-mono mt-1 text-sm font-semibold text-fg">{value}</p>
          </div>
        ))}
      </div>

      {soldOut ? (
        <div className="mt-5 space-y-3">
          <Alert tone="warning" title="Not enough seats for this party on this leg">
            {data.classAvailability.availableSeats === 0
              ? "Every seat in this class is claimed for your segment range. Join the waitlist to keep your place."
              : `Only ${data.classAvailability.availableSeats} seat(s) remain, fewer than the ${passengers} requested.`}
          </Alert>
          <Panel className="p-4">
            <JoinWaitlistForm
              runId={runId}
              from={from}
              to={to}
              travelClass={classResult.data}
              passengerCount={passengers}
            />
          </Panel>
        </div>
      ) : null}

      <div className="mt-5">
        <SeatSelector
          runId={runId}
          from={from}
          to={to}
          travelClass={classResult.data}
          passengerCount={passengers}
          coaches={data.coaches}
          farePerPassengerPaise={farePerPassengerPaise}
          isAuthenticated={Boolean(session)}
          nextPath={nextPath}
        />
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-ink-muted">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Seats released by expired holds are cleaned up lazily inside the allocation
        transaction. Availability can change between display and hold; the server
        rejects the collision safely rather than overselling.
      </p>
    </div>
  );
}
