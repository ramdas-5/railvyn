import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesColumn,
  IndianRupee,
  ListOrdered,
  ScrollText,
  TrainFront,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  getDisruptionImpact,
  getRecentAudit,
  getSystemKpis,
  getUpcomingRunsForOperator,
} from "@/lib/domain/analytics";
import { formatDate, formatTime } from "@/lib/datetime";
import { formatInr, STATUS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "System overview" };
export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  { href: "/admin/network", label: "Add stations and ordered route stops", icon: TrainFront },
  { href: "/admin/runs", label: "Generate dated runs and manage coaches", icon: CalendarClock },
  { href: "/admin/users", label: "Grant roles and operator scopes", icon: Users },
  { href: "/admin/pricing", label: "Set segment fares by class", icon: IndianRupee },
  { href: "/admin/analytics", label: "Review genuine occupancy analytics", icon: ChartNoAxesColumn },
  { href: "/admin/audit", label: "Search the audit trail", icon: ScrollText },
];

export default async function AdminOverviewPage() {
  await requireAdminPage("/admin");
  const [kpis, runs, audit, disruptions] = await Promise.all([
    getSystemKpis(),
    getUpcomingRunsForOperator("all", 6),
    getRecentAudit(6),
    getDisruptionImpact(),
  ]);
  const openDisruptions = disruptions.filter((row) => !row.resolvedAt);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="The network, in one honest view."
        description="Every number here is calculated from PostgreSQL. Manage inventory, access and policy without weakening the segment-claim invariant that protects seat allocation."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/admin/analytics">
                <ChartNoAxesColumn aria-hidden="true" className="h-4 w-4" />
                Analytics
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/runs">
                <CalendarClock aria-hidden="true" className="h-4 w-4" />
                Generate a run
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Upcoming runs"
          value={kpis.upcomingRuns}
          hint="Future, not cancelled"
          tone="dark"
          icon={<TrainFront className="h-4 w-4" />}
        />
        <StatCard
          label="Confirmed bookings"
          value={kpis.confirmedBookings}
          hint={`${kpis.cancelledBookings} cancelled`}
          tone="dark"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Segment occupancy"
          value={`${kpis.occupancyPct}%`}
          hint={`${kpis.seatsSold} seat records sold`}
          tone="dark"
          icon={<ChartNoAxesColumn className="h-4 w-4" />}
        />
        <StatCard
          label="Waitlist / holds"
          value={`${kpis.waitlistWaiting} / ${kpis.activeHolds}`}
          hint="Waiting entries · live holds"
          tone="dark"
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <StatCard
          label="Demo revenue"
          value={formatInr(kpis.demoRevenuePaise)}
          hint={`${kpis.seatReuseCount} reused seats`}
          tone="dark"
          icon={<IndianRupee className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <PanelHeader
            title="Next departures"
            description="Open a run to manage its coaches, inspect the coach × segment matrix and review bookings."
            icon={<TrainFront className="h-4 w-4" />}
            action={
              <Link
                href="/admin/runs"
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
                title="No upcoming runs"
                description="Generate a dated run from the schedules page once a train and route exist."
                icon={<TrainFront className="h-5 w-5" />}
              />
            </div>
          ) : (
            <div className="rv-scroll mt-4">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">Upcoming runs across the network</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Train</th>
                    <th scope="col" className="py-2">Departure</th>
                    <th scope="col" className="py-2">Bookings</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Status</th>
                    <th scope="col" className="py-2 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.runId} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{run.trainCode}</span>
                        <span className="block text-[11px] text-ink-muted">{run.trainName}</span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {formatDate(run.departureAt)}
                        <span className="block text-ink-muted">{formatTime(run.departureAt)}</span>
                      </td>
                      <td className="rv-mono py-2.5">{run.bookings}</td>
                      <td className="rv-mono py-2.5 text-xs">
                        {run.seatsSold}/{run.capacity}
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
                          href={`/admin/runs/${run.runId}`}
                          className="text-xs font-semibold underline underline-offset-2"
                        >
                          Open run
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="p-5">
            <PanelHeader
              title="Disruption exposure"
              description="Open incidents still affecting confirmed bookings."
              icon={<TriangleAlert className="h-4 w-4" />}
              action={
                <Badge tone={openDisruptions.length > 0 ? "warning" : "success"} dot>
                  {openDisruptions.length} open
                </Badge>
              }
            />
            {openDisruptions.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                No unresolved incidents across the network.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {openDisruptions.slice(0, 4).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-small border border-warning-ink/25 bg-warning p-3 text-warning-ink"
                  >
                    <p className="text-sm font-semibold">{row.title}</p>
                    <p className="text-xs">
                      {row.trainCode} · {row.serviceDate} · {row.affectedBookings} confirmed
                      booking{row.affectedBookings === 1 ? "" : "s"} affected
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="p-5">
            <PanelHeader
              title="Recent audit trail"
              description="Privileged actions are written with the actor and role."
              icon={<ScrollText className="h-4 w-4" />}
              action={
                <Link
                  href="/admin/audit"
                  className="text-xs font-semibold underline underline-offset-2"
                >
                  Search
                </Link>
              }
            />
            {audit.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">No audit entries yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {audit.map((entry) => (
                  <li key={`${entry.action}-${entry.createdAt.toString()}`} className="border-t border-line-light/70 pt-2">
                    <p className="rv-mono text-[11px] font-semibold">{entry.action}</p>
                    <p className="text-[11px] text-ink-muted">
                      {entry.actorName ?? "System"} · {formatDate(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel className="p-5">
        <PanelHeader title="Administration shortcuts" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center gap-3 rounded-chip border border-line-light px-3 text-sm hover:bg-subtle"
              >
                <Icon aria-hidden="true" className="h-4 w-4 text-ink-muted" />
                <span className="flex-1">{link.label}</span>
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
