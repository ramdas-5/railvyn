import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search, TicketCheck, Timer } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listOperatorTrainIds } from "@/lib/permissions";
import {
  getOperatorBookings,
  getOperatorHolds,
} from "@/lib/queries/operator";
import { formatDate, formatTime } from "@/lib/datetime";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { OperatorBookingsTable } from "@/components/operator/bookings-table";

export const metadata: Metadata = { title: "Bookings & holds" };
export const dynamic = "force-dynamic";

export default async function OperatorBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator/bookings");
  if (!user.isOperator) return <AccessDenied />;

  const { q = "" } = await searchParams;
  const trainIds = await listOperatorTrainIds(user);
  const [bookings, holds] = await Promise.all([
    getOperatorBookings(trainIds, q),
    getOperatorHolds(trainIds),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations"
        title="Bookings & live holds"
        description="Search by RAILVYN reference, passenger, email or train code. Results are limited to trains inside your operator scope."
      />

      <Panel className="p-5">
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-64 flex-1">
            <label htmlFor="booking-search" className="rv-label">
              Search bookings
            </label>
            <Input
              id="booking-search"
              name="q"
              defaultValue={q}
              placeholder="RVN-… / passenger@example.com / 12451"
              type="search"
            />
          </div>
          <Button type="submit" size="md">
            <Search aria-hidden="true" className="h-4 w-4" />
            Search scope
          </Button>
          {q ? (
            <Button asChild variant="outline" size="md">
              <a href="/operator/bookings">Clear</a>
            </Button>
          ) : null}
        </form>
        <p className="mt-2 text-[11px] text-ink-muted">
          Server-side scope applies to every query. Client route hiding is never used
          as authorization.
        </p>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title={q ? `Results for “${q}”` : "Booking registry"}
          description={`${bookings.length} booking${bookings.length === 1 ? "" : "s"} in scope.`}
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
            <OperatorBookingsTable rows={bookings} />
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Live holds"
          description="Unexpired holds only; the allocation transaction releases expired claims lazily."
          icon={<Timer className="h-4 w-4" />}
        />
        <div className="mt-4">
          {holds.length === 0 ? (
            <p className="rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
              No active holds in scope right now.
            </p>
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">Active seat holds in operator scope</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Passenger</th>
                    <th scope="col" className="py-2">Train</th>
                    <th scope="col" className="py-2">Journey</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Class</th>
                    <th scope="col" className="py-2">Expires</th>
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
