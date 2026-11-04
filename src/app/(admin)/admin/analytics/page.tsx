import type { Metadata } from "next";
import {
  ChartNoAxesColumn,
  IndianRupee,
  ListOrdered,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  getBookingsTrend,
  getClassUtilisation,
  getDisruptionImpact,
  getSeatReuseExamples,
  getSystemKpis,
} from "@/lib/domain/analytics";
import { formatDateTime } from "@/lib/datetime";
import { formatInr, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import {
  Alert,
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/ui/surfaces";
import { BookingsTrendChart } from "@/components/admin/analytics-charts";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdminPage("/admin/analytics");
  const [kpis, trend, utilisation, reuse, disruptions] = await Promise.all([
    getSystemKpis(),
    getBookingsTrend(),
    getClassUtilisation(),
    getSeatReuseExamples(10),
    getDisruptionImpact(),
  ]);
  const maxClaims = Math.max(1, ...utilisation.map((row) => row.segmentClaims));

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Analytics from actual claims."
        description="Occupancy is booked segment claims divided by physical seats × segments. Seat reuse counts physical seats sold to more than one booking on non-overlapping legs. Nothing here is sample data."
      />

      <Alert tone="info" title="How these numbers are calculated">
        Confirmed bookings only, except cancellation rate. Demo revenue is the sum of
        succeeded demo payments; it is not real money.
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Occupancy"
          value={`${kpis.occupancyPct}%`}
          hint="Claims ÷ available seat-segments"
          tone="dark"
          icon={<ChartNoAxesColumn className="h-4 w-4" />}
        />
        <StatCard
          label="Booked segments"
          value={kpis.seatsSold}
          hint="Confirmed passenger-seat records"
          tone="dark"
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <StatCard
          label="Seat reuse"
          value={kpis.seatReuseCount}
          hint="Physical seats with multiple bookings"
          tone="dark"
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <StatCard
          label="Cancellation rate"
          value={`${kpis.cancellationRatePct}%`}
          hint={`${kpis.cancelledBookings} cancelled bookings`}
          tone="dark"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Demo revenue"
          value={formatInr(kpis.demoRevenuePaise)}
          hint="Succeeded demo payments only"
          tone="dark"
          icon={<IndianRupee className="h-4 w-4" />}
        />
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Bookings trend, last 30 days"
          description="Created bookings and cancellations per day, in the app timezone."
          icon={<ChartNoAxesColumn className="h-4 w-4" />}
        />
        <div className="mt-4">
          <BookingsTrendChart data={trend} />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader
            title="Class utilisation"
            description="Claims per physical seat across all runs of each class."
          />
          <div className="mt-4 space-y-3">
            {utilisation.length === 0 ? (
              <EmptyState
                title="No inventory yet"
                description="Add coaches to generated runs to measure class utilisation."
                icon={<ChartNoAxesColumn className="h-5 w-5" />}
              />
            ) : (
              utilisation.map((row) => {
                const label =
                  TRAVEL_CLASS_LABELS[row.travelClass as keyof typeof TRAVEL_CLASS_LABELS] ??
                  row.travelClass;
                return (
                  <div key={row.travelClass}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">{label}</span>
                      <span className="rv-mono text-xs text-ink-muted">
                        {row.segmentClaims} claims · {row.seats} seats
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-light">
                      <div
                        className="h-full rounded-full bg-accent-ink"
                        style={{ width: `${Math.min(100, (row.segmentClaims / maxClaims) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-ink-muted">
                      Confirmed fares: {formatInr(row.revenuePaise)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Waitlist and holds"
            description="Open operational work right now."
            icon={<ListOrdered className="h-4 w-4" />}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-small border border-line-light bg-subtle/50 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Waiting</p>
              <p className="rv-mono mt-2 text-xl font-semibold">{kpis.waitlistWaiting}</p>
            </div>
            <div className="rounded-small border border-line-light bg-subtle/50 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Live holds</p>
              <p className="rv-mono mt-2 text-xl font-semibold">{kpis.activeHolds}</p>
            </div>
            <div className="rounded-small border border-line-light bg-subtle/50 p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">Confirmed</p>
              <p className="rv-mono mt-2 text-xl font-semibold">{kpis.confirmedBookings}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Seat reuse examples"
          description="The same physical seat sold to multiple bookings on non-overlapping legs — the core journey-aware behaviour."
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <div className="mt-4">
          {reuse.length === 0 ? (
            <EmptyState
              title="No reused seats yet"
              description="Reuse appears when a later booking takes a seat after an earlier passenger alights."
              icon={<RefreshCw className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">Seats reused across non-overlapping legs</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Train</th>
                    <th scope="col" className="py-2">Service date</th>
                    <th scope="col" className="py-2">Seat</th>
                    <th scope="col" className="py-2">Bookings</th>
                    <th scope="col" className="py-2">Legs</th>
                  </tr>
                </thead>
                <tbody>
                  {reuse.map((row) => (
                    <tr
                      key={`${row.trainName}-${row.serviceDate}-${row.coachCode}-${row.seatNumber}`}
                      className="border-t border-line-light/70"
                    >
                      <td className="py-2.5 text-xs">{row.trainName}</td>
                      <td className="rv-mono py-2.5 text-xs">{row.serviceDate}</td>
                      <td className="rv-mono py-2.5 text-xs">
                        {row.coachCode} · {row.seatNumber}
                      </td>
                      <td className="rv-mono py-2.5">{row.bookings}</td>
                      <td className="py-2.5 text-xs text-ink-muted">{row.legs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Recent disruptions"
          description="Including the number of confirmed bookings on each affected run."
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <div className="mt-4">
          {disruptions.length === 0 ? (
            <p className="text-sm text-ink-muted">No disruptions recorded.</p>
          ) : (
            <div className="space-y-2">
              {disruptions.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-small border border-line-light p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{row.title}</p>
                    <p className="text-[11px] text-ink-muted">
                      {row.trainCode} · {row.serviceDate} · {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={row.resolvedAt ? "success" : "warning"}>
                      {row.resolvedAt ? "Resolved" : "Open"}
                    </Badge>
                    <span className="rv-mono text-xs text-ink-muted">
                      {row.affectedBookings} booking{row.affectedBookings === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
