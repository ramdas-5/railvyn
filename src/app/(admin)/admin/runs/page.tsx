import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarClock, TrainFront } from "lucide-react";
import { getAdminRuns, getAdminTrains } from "@/lib/queries/admin";
import { generateRunAction } from "@/actions/admin";
import { formatDate, formatTime, todayInAppZone } from "@/lib/datetime";
import { STATUS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Schedules & runs" };
export const dynamic = "force-dynamic";

export default async function AdminRunsPage() {
  await requireAdminPage("/admin/runs");
  const [runs, trains] = await Promise.all([getAdminRuns(), getAdminTrains()]);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Schedules and dated runs"
        description="A run is one train on one service date. Generating a run copies the newest template per class into physical coaches and run seats, so later template edits never rewrite sold inventory."
      />

      <Panel className="p-5">
        <PanelHeader
          title="Generate a run"
          description="The departure is interpreted in Asia/Kolkata and stored as UTC. One run per train and service date is allowed."
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <div className="mt-4">
          <ActionForm
            action={generateRunAction}
            submitLabel="Generate run"
            fields={[
              {
                name: "trainId",
                label: "Train",
                type: "select",
                required: true,
                colSpan: 2,
                options: trains.map((train) => ({
                  value: train.id,
                  label: `${train.code} — ${train.name} (${train.stopCount} stops)`,
                })),
              },
              {
                name: "serviceDate",
                label: "Service date",
                type: "date",
                required: true,
                defaultValue: todayInAppZone(),
              },
              { name: "departureHour", label: "Departure hour (0–23)", type: "number", min: 0, max: 23, required: true, defaultValue: 6 },
              { name: "departureMinute", label: "Departure minute (0–59)", type: "number", min: 0, max: 59, required: true, defaultValue: 0 },
            ]}
          />
        </div>
        {trains.length === 0 ? (
          <p className="mt-3 text-xs text-warning-ink">
            Create a train first on the{" "}
            <a className="underline underline-offset-2" href="/admin/trains">
              trains page
            </a>
            .
          </p>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Run registry"
          description={`${runs.length} most recent run${runs.length === 1 ? "" : "s"}. Open a run to add coaches and inspect segment occupancy.`}
          icon={<TrainFront className="h-4 w-4" />}
        />
        <div className="mt-4">
          {runs.length === 0 ? (
            <EmptyState
              title="No runs yet"
              description="Generate a dated run for an existing train and route."
              icon={<TrainFront className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <caption className="sr-only">Dated train runs</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Train</th>
                    <th scope="col" className="py-2">Service date</th>
                    <th scope="col" className="py-2">Departure</th>
                    <th scope="col" className="py-2">Coaches</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Bookings</th>
                    <th scope="col" className="py-2">Holds</th>
                    <th scope="col" className="py-2">Status</th>
                    <th scope="col" className="py-2 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{run.trainCode}</span>
                        <span className="block text-[11px] text-ink-muted">{run.trainName}</span>
                      </td>
                      <td className="rv-mono py-2.5 text-xs">{run.serviceDate}</td>
                      <td className="py-2.5 text-xs">
                        {formatDate(run.departureAt)}
                        <span className="block text-ink-muted">{formatTime(run.departureAt)}</span>
                      </td>
                      <td className="rv-mono py-2.5 text-xs">{run.coaches}</td>
                      <td className="rv-mono py-2.5 text-xs">{run.capacity}</td>
                      <td className="rv-mono py-2.5 text-xs">{run.bookings}</td>
                      <td className="rv-mono py-2.5 text-xs">{run.activeHolds}</td>
                      <td className="py-2.5">
                        <Badge
                          tone={
                            run.status === "disrupted"
                              ? "warning"
                              : run.status === "cancelled"
                                ? "danger"
                                : run.status === "completed"
                                  ? "neutral"
                                  : "success"
                          }
                        >
                          {STATUS_LABELS[run.status] ?? run.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/admin/runs/${run.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
                        >
                          Open
                          <ArrowRight aria-hidden="true" className="h-3 w-3" />
                        </Link>
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
