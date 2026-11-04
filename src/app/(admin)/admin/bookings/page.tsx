import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Search, TicketCheck, Timer } from "lucide-react";
import { getOperatorBookings, getOperatorHolds } from "@/lib/queries/operator";
import { requireAdminPage } from "@/lib/page-auth";
import { formatDate, formatTime } from "@/lib/datetime";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import {
  EmptyState,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/ui/surfaces";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { OperatorBookingsTable } from "@/components/operator/bookings-table";

export const metadata: Metadata = { title: "Booking registry" };
export const dynamic = "force-dynamic";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage("/admin/bookings");

  const { q = "" } = await searchParams;
  const [bookings, holds] = await Promise.all([
    getOperatorBookings("all", q),
    getOperatorHolds("all"),
  ]);

  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const cancelled = bookings.length - confirmed.length;
  const seats = confirmed.reduce(
    (total, booking) => total + booking.passengerCount,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Booking registry"
        description="Every booking across the network, owned by whichever passenger made it. This is a management view, not a personal ticket wallet: use a run's operations console to reassign seats or cancel, and every privileged action is re-authorised and audited."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/operator">
                <TicketCheck aria-hidden="true" className="h-4 w-4" />
                Operations console
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/audit">
                Audit log
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Confirmed"
          value={confirmed.length}
          hint="In the current view"
          tone="dark"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Cancelled"
          value={cancelled}
          hint="In the current view"
          tone="dark"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Passengers"
          value={seats}
          hint="Seats on confirmed bookings"
          tone="dark"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Live holds"
          value={holds.length}
          hint="Unexpired across all runs"
          tone="dark"
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <Panel className="p-5">
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-64 flex-1">
            <label htmlFor="admin-booking-search" className="rv-label">
              Search all bookings
            </label>
            <Input
              id="admin-booking-search"
              name="q"
              defaultValue={q}
              placeholder="RVN-… / passenger@example.com / 12451"
              type="search"
            />
          </div>
          <Button type="submit" size="md">
            <Search aria-hidden="true" className="h-4 w-4" />
            Search registry
          </Button>
          {q ? (
            <Button asChild variant="outline" size="md">
              <a href="/admin/bookings">Clear</a>
            </Button>
          ) : null}
        </form>
        <p className="mt-2 text-[11px] text-ink-muted">
          Matches the RAILVYN reference, owning account, or train code. Search is
          executed on the server against PostgreSQL.
        </p>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title={q ? `Results for “${q}”` : "All bookings"}
          description={`${bookings.length} booking${bookings.length === 1 ? "" : "s"} across every train run.`}
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <div className="mt-4">
          {bookings.length === 0 ? (
            <EmptyState
              title="No bookings match"
              description="Try a shorter reference fragment, the account email, or the train number."
              icon={<TicketCheck className="h-5 w-5" />}
            />
          ) : (
            <OperatorBookingsTable
              rows={bookings}
              caption="Network-wide booking registry"
            />
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Live holds"
          description="Unexpired holds across all runs. Expired claims are released lazily inside the allocation transaction."
          icon={<Timer className="h-4 w-4" />}
        />
        <div className="mt-4">
          {holds.length === 0 ? (
            <p className="rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
              No active holds anywhere right now.
            </p>
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">
                  Active seat holds across the network
                </caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">
                      Passenger
                    </th>
                    <th scope="col" className="py-2">
                      Train
                    </th>
                    <th scope="col" className="py-2">
                      Journey
                    </th>
                    <th scope="col" className="py-2">
                      Seats
                    </th>
                    <th scope="col" className="py-2">
                      Class
                    </th>
                    <th scope="col" className="py-2">
                      Expires
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map((hold) => (
                    <tr key={hold.id} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{hold.passengerName}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {hold.passengerEmail}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {hold.trainCode}
                        <span className="block text-ink-muted">{hold.trainName}</span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {hold.fromCode} → {hold.toCode}
                      </td>
                      <td className="py-2.5 text-xs">{hold.seatLabels || "—"}</td>
                      <td className="py-2.5 text-xs">
                        {TRAVEL_CLASS_LABELS[hold.travelClass]}
                      </td>
                      <td className="py-2.5 text-xs">
                        {formatDate(hold.expiresAt)} · {formatTime(hold.expiresAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
