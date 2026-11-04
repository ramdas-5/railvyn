import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Ban,
  MapPin,
  Printer,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { getBookingDetail } from "@/lib/domain/reservations";
import { requireUserPage } from "@/lib/page-auth";
import { formatFullDate, formatTime, msRemaining } from "@/lib/datetime";
import { formatInr, STATUS_LABELS, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { berthedLabel } from "@/lib/labels";
import { DemoCode } from "@/components/booking/demo-code";
import { Badge, DemoNotice, Panel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: "Booking ticket" };
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { id } = await params;
  const user = await requireUserPage(`/my-bookings/${id}`);
  const query = await searchParams;
  let detail: Awaited<ReturnType<typeof getBookingDetail>>;
  try {
    detail = await getBookingDetail(id);
  } catch {
    notFound();
  }
  if (detail.booking.userId !== user.id && !user.isOperator) redirect("/my-bookings");

  const departure = new Date(detail.run.departureAt);
  const future = msRemaining(departure) > 0;
  const cancelled = detail.booking.status === "cancelled";

  return (
    <div className="space-y-5">
      <Link
        href="/my-bookings"
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        All bookings
      </Link>

      {query.cancelled ? (
        <div className="rounded-small border border-success-ink/25 bg-success p-3 text-sm text-success-ink">
          Cancellation completed. Seat claims were released and the demo payment is
          marked refunded. Any eligible waitlist entry may have been promoted.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Internal ticket · demonstration
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold">{detail.train.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {detail.train.code} · {formatFullDate(departure)} ·{" "}
            {TRAVEL_CLASS_LABELS[detail.booking.travelClass]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={cancelled ? "danger" : "success"} dot>
            {STATUS_LABELS[detail.booking.status]}
          </Badge>
          <Badge tone="neutral">{detail.booking.reference}</Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel feature className="overflow-hidden p-0">
          <div className="border-b border-line-light bg-subtle/50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Ticket aria-hidden="true" className="h-4 w-4" />
                RAILVYN booking reference
              </p>
              <p className="rv-mono text-lg font-bold">{detail.booking.reference}</p>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">
              Not an official PNR. Issued by RAILVYN for this demonstration.
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="rv-mono text-2xl font-semibold">
                  {formatTime(departure)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  {detail.fromStop?.code} · {detail.fromStop?.name}
                </p>
                <p className="text-xs text-ink-muted">
                  Scheduled departure from boarding stop
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {detail.toStop?.code} · {detail.toStop?.name}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {detail.durationMinutes} minutes ·{" "}
                  {TRAVEL_CLASS_LABELS[detail.booking.travelClass]}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                  {detail.run.serviceDate}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-small border border-line-light">
              <table className="w-full min-w-[35rem] text-left text-sm">
                <caption className="sr-only">
                  Passenger, seat and fare details for this RAILVYN booking
                </caption>
                <thead className="bg-subtle/60 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Passenger</th>
                    <th scope="col" className="px-3 py-2">Coach</th>
                    <th scope="col" className="px-3 py-2">Seat</th>
                    <th scope="col" className="px-3 py-2">Berth</th>
                    <th scope="col" className="px-3 py-2 text-right">Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.seats.map((seat) => (
                    <tr key={seat.bookingSeatId} className="border-t border-line-light/70">
                      <td className="px-3 py-2.5">
                        <p className="font-semibold">{seat.fullName}</p>
                        <p className="text-xs text-ink-muted">
                          {seat.age} yrs · {seat.gender}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{seat.coachCode}</td>
                      <td className="rv-mono px-3 py-2.5">{seat.seatNumber}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {berthedLabel(seat.berthType)}
                        {seat.isAccessible ? " · accessible" : ""}
                      </td>
                      <td className="rv-mono px-3 py-2.5 text-right">
                        {formatInr(seat.farePaise)}
                      </td>
                    </tr>
                  ))}
                  {detail.seats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-muted">
                        No seat links remain because this booking was cancelled.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-light pt-3">
              <div>
                <p className="text-xs text-ink-muted">Contact</p>
                <p className="text-sm font-semibold">{detail.booking.contactEmail}</p>
                {detail.booking.contactPhone ? (
                  <p className="text-xs text-ink-muted">{detail.booking.contactPhone}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-muted">Total (demo)</p>
                <p className="rv-mono text-xl font-semibold">
                  {formatInr(detail.booking.totalFarePaise)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  {detail.payment?.status === "refunded" ? "Refunded (demo)" : "Paid (demo)"}
                </p>
              </div>
            </div>

            {cancelled ? (
              <div className="mt-4 rounded-small border border-danger-ink/20 bg-danger p-3 text-xs text-danger-ink">
                <p className="flex items-center gap-2 font-semibold">
                  <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                  Cancelled {detail.booking.cancelledAt ? formatFullDate(detail.booking.cancelledAt) : ""}
                </p>
                <p className="mt-1">
                  {detail.booking.cancellationReason ?? "No reason was provided."} All
                  segment claims for this booking were released.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {!cancelled && future ? (
                <Button asChild size="sm" variant="danger">
                  <Link href={`/my-bookings/${detail.booking.id}/cancel`}>Cancel booking</Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href="/search">Book another journey</Link>
              </Button>
              <span className="inline-flex items-center gap-1.5 rounded-chip border border-line-light px-3 py-1.5 text-[11px] text-ink-muted">
                <Printer aria-hidden="true" className="h-3.5 w-3.5" />
                Use your browser’s print dialog for a demo receipt
              </span>
            </div>
          </div>
        </Panel>

        <aside className="space-y-4">
          <Panel className="p-5 text-center">
            <DemoCode value={detail.booking.reference} className="mx-auto" />
          </Panel>
          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Compliance
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              This document is generated by an independent educational booking
              system. It is not valid for travel and does not represent Indian
              Railways or IRCTC.
            </p>
            <DemoNotice className="mt-3" />
          </Panel>
          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Journey stops
            </p>
            <ol className="mt-2 space-y-1.5 text-xs">
              {detail.stops.map((stop) => {
                const isFrom = stop.stopIndex === detail.booking.fromStopIndex;
                const isTo = stop.stopIndex === detail.booking.toStopIndex;
                return (
                  <li
                    key={stop.stopIndex}
                    className={
                      isFrom || isTo
                        ? "flex justify-between gap-2 font-semibold text-ink"
                        : "flex justify-between gap-2 text-ink-muted"
                    }
                  >
                    <span>
                      {stop.code} {isFrom ? "· boarding" : isTo ? "· alighting" : ""}
                    </span>
                    <span className="rv-mono">{stop.offsetMinutes}m</span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
