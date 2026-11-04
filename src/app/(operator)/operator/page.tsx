import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Gauge,
  ListOrdered,
  TicketCheck,
  TrainFront,
  TriangleAlert,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listOperatorTrainIds } from "@/lib/permissions";
import { getUpcomingRunsForOperator } from "@/lib/domain/analytics";
import {
  getOperatorDisruptions,
  getOperatorStats,
} from "@/lib/queries/operator";
import { formatDate, formatTime } from "@/lib/datetime";
import { STATUS_LABELS } from "@/lib/utils";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel, PanelHeader, StatCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Operations overview" };
export const dynamic = "force-dynamic";

export default async function OperatorOverviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator");
  if (!user.isOperator) return <AccessDenied />;

  const trainIds = await listOperatorTrainIds(user);
  const [stats, runs, disruptions] = await Promise.all([
    getOperatorStats(trainIds),
    getUpcomingRunsForOperator(trainIds, 6),
    getOperatorDisruptions(trainIds),
  ]);
  const activeDisruptions = disruptions.filter((disruption) => !disruption.resolvedAt);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations cockpit"
        title="Run everything from one quiet console."
        description={
          trainIds === "all"
            ? "Administrator scope: all trains. Every mutation below is still checked against the server-side scope rules and written to the audit trail."
            : `Scope: ${trainIds.length} assigned train${trainIds.length === 1 ? "" : "s"}. Runs outside your assignment are neither listed nor operable.`
        }
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/operator/runs">
                <TrainFront aria-hidden="true" className="h-4 w-4" />
                Assigned runs
              </Link>
            </Button>
            <Button asChild>
              <Link href="/operator/disruptions">
                <TriangleAlert aria-hidden="true" className="h-4 w-4" />
                Log disruption
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Upcoming runs"
          value={stats.upcomingRuns}
          hint="Not cancelled"
          tone="dark"
          icon={<TrainFront className="h-4 w-4" />}
        />
        <StatCard
          label="Confirmed bookings"
          value={stats.confirmedBookings}
          hint="Across your scope"
          tone="dark"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Seats sold"
          value={stats.seatsSold}
          hint="Passenger-seat records"
          tone="dark"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Live holds"
          value={stats.activeHolds}
          hint="Unexpired only"
          tone="dark"
          icon={<Gauge className="h-4 w-4" />}
        />
        <StatCard
          label="Waitlist open"
          value={stats.waitlistOpen}
          hint="Waiting or offered"
          tone="dark"
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <StatCard
          label="Open incidents"
          value={stats.activeDisruptions}
          hint="Unresolved disruptions"
          tone="dark"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <PanelHeader
            title="Next departures"
            description="Occupancy is confirmed seat records, not segment-adjusted load. Open a run for the segment matrix."
            icon={<TrainFront className="h-4 w-4" />}
            action={
              <Link
                href="/operator/runs"
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink underline underline-offset-2"
              >
                All runs
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            }
          />
          {runs.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No upcoming runs in your scope"
                description="An administrator can assign train scopes or generate new dated runs."
                icon={<TrainFront className="h-5 w-5" />}
              />
            </div>
          ) : (
            <div className="rv-scroll mt-4">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Next departures in operator scope</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Run</th>
                    <th scope="col" className="py-2">Departure</th>
                    <th scope="col" className="py-2">Bookings</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Status</th>
                    <th scope="col" className="py-2 text-right">Console</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const load =
                      run.capacity > 0
                        ? Math.round((run.seatsSold / run.capacity) * 100)
                        : 0;
                    return (
                      <tr key={run.runId} className="border-t border-line-light/70">
                        <td className="py-2.5">
                          <span className="font-semibold">{run.trainCode}</span>
                          <span className="block text-[11px] text-ink-muted">
                            {run.trainName}
                          </span>
                        </td>
                        <td className="py-2.5 text-xs">
                          {formatDate(run.departureAt)}
                          <span className="block text-ink-muted">
                            {formatTime(run.departureAt)}
                          </span>
                        </td>
                        <td className="rv-mono py-2.5">{run.bookings}</td>
                        <td className="py-2.5 text-xs">
                          <span className="rv-mono">{run.seatsSold}/{run.capacity}</span>
                          <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-line-light">
                            <span
                              className="block h-full rounded-full bg-accent-ink"
                              style={{ width: `${Math.min(100, load)}%` }}
                            />
                          </span>
                        </td>
                        <td className="py-2.5">
                          <Badge
                            tone={
                              run.status === "disrupted"
                                ? "warning"
                                : run.status === "cancelled"
                                  ? "danger"
                                  : "success"
                            }
                          >
                            {STATUS_LABELS[run.status] ?? run.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={`/operator/runs/${run.runId}`}
                            className="text-xs font-semibold underline underline-offset-2"
                          >
                            Occupancy
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <PanelHeader
              title="Open incidents"
              description="Resolve from the disruption log; the run returns to scheduled when the last incident clears."
              icon={<TriangleAlert className="h-4 w-4" />}
              action={
                <Badge tone={activeDisruptions.length > 0 ? "warning" : "success"} dot>
                  {activeDisruptions.length} open
                </Badge>
              }
            />
            {activeDisruptions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                No unresolved incidents in your scope.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activeDisruptions.slice(0, 4).map((disruption) => (
                  <li
                    key={disruption.id}
                    className="rounded-small border border-warning-ink/25 bg-warning p-3 text-warning-ink"
                  >
                    <p className="text-sm font-semibold">{disruption.title}</p>
                    <p className="text-xs">
                      {disruption.trainCode} · {formatDate(disruption.serviceDate)} ·{" "}
                      {disruption.severity}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/operator/disruptions"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
            >
              Disruption log
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </Link>
          </Panel>

          <Panel className="p-5">
            <PanelHeader title="Quick actions" icon={<Gauge className="h-4 w-4" />} />
            <div className="mt-3 grid gap-2">
              {[
                { href: "/operator/bookings", label: "Find a booking or live hold" },
                { href: "/operator/waitlist", label: "Review the waitlist queue" },
                { href: "/operator/runs", label: "Open coach occupancy" },
                { href: "/operator/disruptions", label: "Record an incident" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-chip border border-line-light px-3 text-sm hover:bg-subtle"
                >
                  {action.label}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
