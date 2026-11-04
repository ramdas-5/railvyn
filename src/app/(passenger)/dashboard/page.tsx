import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarClock,
  ListOrdered,
  Search,
  Ticket,
  TrainFront,
} from "lucide-react";
import { requireUser } from "@/lib/permissions";
import { listUserBookings } from "@/lib/domain/reservations";
import { listWaitlistForUser } from "@/lib/domain/waitlist";
import { formatDate, formatTime, msRemaining } from "@/lib/datetime";
import { formatInr, STATUS_LABELS } from "@/lib/utils";
import { Badge, EmptyState, Panel, PanelHeader, StatCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";

export const metadata: Metadata = { title: "Passenger dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [bookings, waitlists] = await Promise.all([
    listUserBookings(user.id),
    listWaitlistForUser(user.id),
  ]);

  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const upcoming = confirmed
    .filter((booking) => msRemaining(booking.departureAt) > 0)
    .sort(
      (a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime(),
    );
  const nextJourney = upcoming[0];
  const offers = waitlists.filter((entry) => entry.status === "offered");

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Passenger"
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description="Your held seats, journeys and waitlist places — all from the live demonstration database."
        actions={
          <Button asChild>
            <Link href="/search">
              <Search aria-hidden="true" className="h-4 w-4" />
              Find a journey
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming journeys"
          value={upcoming.length}
          hint="Confirmed and not yet departed"
          tone="dark"
          icon={<TrainFront className="h-4 w-4" />}
        />
        <StatCard
          label="Confirmed bookings"
          value={confirmed.length}
          hint="Across all demonstration runs"
          tone="dark"
          icon={<Ticket className="h-4 w-4" />}
        />
        <StatCard
          label="Waitlist places"
          value={waitlists.filter((entry) => entry.status === "waiting").length}
          hint="FIFO within priority category"
          tone="dark"
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <StatCard
          label="Offers to confirm"
          value={offers.length}
          hint="Short-lived holds — confirm before expiry"
          tone="dark"
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <PanelHeader
            title="Your next journey"
            description={
              nextJourney
                ? "Present this reference if you are testing the operator console."
                : "No upcoming confirmed journey yet."
            }
            icon={<TrainFront className="h-4 w-4" />}
            action={
              nextJourney ? (
                <Badge tone="success" dot>
                  Confirmed
                </Badge>
              ) : null
            }
          />
          {nextJourney ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="rv-mono text-xs text-ink-muted">
                    {nextJourney.trainCode} · {formatDate(nextJourney.departureAt)} ·{" "}
                    {formatTime(nextJourney.departureAt)}
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {nextJourney.fromCode} → {nextJourney.toCode}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {nextJourney.fromName} to {nextJourney.toName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="rv-mono text-lg font-semibold">{nextJourney.reference}</p>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    RAILVYN reference
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 rounded-small border border-line-light bg-white/50 p-3 text-xs sm:grid-cols-3">
                <p>
                  <span className="text-ink-muted">Seats</span>
                  <br />
                  <span className="font-semibold">{nextJourney.seatLabels || "—"}</span>
                </p>
                <p>
                  <span className="text-ink-muted">Passengers</span>
                  <br />
                  <span className="rv-mono font-semibold">{nextJourney.passengerCount}</span>
                </p>
                <p>
                  <span className="text-ink-muted">Demo fare</span>
                  <br />
                  <span className="rv-mono font-semibold">
                    {formatInr(nextJourney.totalFarePaise)}
                  </span>
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/my-bookings/${nextJourney.id}`}>
                    <Ticket aria-hidden="true" className="h-3.5 w-3.5" />
                    Open ticket
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/my-bookings/${nextJourney.id}/cancel`}>
                    Cancellation options
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title="The rails are quiet"
                description="Search a demonstration departure and hold a seat. Availability is calculated for your exact leg."
                icon={<TrainFront className="h-5 w-5" />}
                action={
                  <Button asChild size="sm">
                    <Link href="/search">Search trains</Link>
                  </Button>
                }
              />
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          {offers.length > 0 ? (
            <Panel className="p-5">
              <PanelHeader
                title="Waitlist offer"
                description="A seat is being held for you. Confirm before the offer expires."
                icon={<ListOrdered className="h-4 w-4" />}
              />
              <ul className="mt-3 space-y-2">
                {offers.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-small border border-warning-ink/25 bg-warning p-3 text-warning-ink"
                  >
                    <p className="text-sm font-semibold">
                      {entry.trainName} · {entry.fromCode} → {entry.toCode}
                    </p>
                    <p className="text-xs">
                      {formatDate(entry.serviceDate)} · {entry.passengerCount} passenger(s)
                    </p>
                    {entry.offeredHoldId ? (
                      <Link
                        href={`/checkout/${entry.offeredHoldId}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
                      >
                        Continue to checkout
                        <ArrowRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel className="p-5">
            <PanelHeader title="Waitlist & requests" icon={<ListOrdered className="h-4 w-4" />} />
            {waitlists.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                No waitlist entries. Join from a run page when a class is full.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line-light/70">
                {waitlists.slice(0, 5).map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {entry.fromCode} → {entry.toCode}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {entry.trainName} · {formatDate(entry.serviceDate)}
                      </p>
                    </div>
                    <Badge
                      tone={
                        entry.status === "offered"
                          ? "warning"
                          : entry.status === "waiting"
                            ? "neutral"
                            : "success"
                      }
                    >
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel className="p-5 sm:p-6">
        <PanelHeader
          title="Recent bookings"
          description="Confirmed, cancelled and past journeys. Never an official ticket."
          icon={<Ticket className="h-4 w-4" />}
          action={
            <Link
              href="/my-bookings"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink underline underline-offset-2"
            >
              All bookings
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          }
        />
        {bookings.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No bookings yet"
              description="Your first confirmed journey will appear here with its internal reference."
              icon={<Ticket className="h-5 w-5" />}
            />
          </div>
        ) : (
          <div className="rv-scroll mt-4">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">Recent RAILVYN bookings</caption>
              <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th scope="col" className="py-2">Reference</th>
                  <th scope="col" className="py-2">Journey</th>
                  <th scope="col" className="py-2">Date</th>
                  <th scope="col" className="py-2">Seats</th>
                  <th scope="col" className="py-2">Status</th>
                  <th scope="col" className="py-2 text-right">Fare</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((booking) => (
                  <tr key={booking.id} className="border-t border-line-light/70">
                    <td className="py-2.5">
                      <Link
                        href={`/my-bookings/${booking.id}`}
                        className="rv-mono font-semibold underline underline-offset-2"
                      >
                        {booking.reference}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      {booking.fromCode} → {booking.toCode}
                    </td>
                    <td className="py-2.5 text-xs">{formatDate(booking.departureAt)}</td>
                    <td className="py-2.5 text-xs">{booking.seatLabels || "—"}</td>
                    <td className="py-2.5">
                      <Badge tone={booking.status === "confirmed" ? "success" : "danger"}>
                        {STATUS_LABELS[booking.status]}
                      </Badge>
                    </td>
                    <td className="rv-mono py-2.5 text-right">
                      {formatInr(booking.totalFarePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
