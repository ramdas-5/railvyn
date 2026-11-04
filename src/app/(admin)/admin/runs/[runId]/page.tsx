import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Armchair, CalendarClock, TrainFront } from "lucide-react";
import {
  getAdminCoachTemplates,
  getAdminRunDetail,
} from "@/lib/queries/admin";
import { getRunCoachMatrix, getRunSegmentOccupancy } from "@/lib/domain/analytics";
import {
  addRunCoachAction,
  removeRunCoachAction,
} from "@/actions/admin";
import { formatDate, formatTime } from "@/lib/datetime";
import { STATUS_LABELS, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { InlineActionForm } from "@/components/forms/inline-action-form";
import { OccupancyMatrix } from "@/components/operator/occupancy-matrix";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Run detail" };
export const dynamic = "force-dynamic";

export default async function AdminRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  await requireAdminPage(`/admin/runs/${runId}`);
  const detail = await getAdminRunDetail(runId);
  if (!detail) notFound();

  const [templates, segments, matrix] = await Promise.all([
    getAdminCoachTemplates(),
    getRunSegmentOccupancy(runId),
    getRunCoachMatrix(runId),
  ]);
  const usedTemplateIds = new Set(detail.coaches.map((coach) => coach.templateCode));
  const availableTemplates = templates.filter(
    (template) => !usedTemplateIds.has(template.code),
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/runs">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            All runs
          </Link>
        </Button>
      </div>

      <PageHeading
        eyebrow={`Run · ${detail.run.routeCode}`}
        title={`${detail.run.trainCode} — ${detail.run.trainName}`}
        description={`${formatDate(detail.run.departureAt)} · departs ${formatTime(detail.run.departureAt)} · ${detail.stops.length} stops. Coaches with live claims cannot be removed; move bookings first.`}
        actions={
          <Badge
            tone={
              detail.run.status === "disrupted"
                ? "warning"
                : detail.run.status === "cancelled"
                  ? "danger"
                  : "success"
            }
            dot
          >
            {STATUS_LABELS[detail.run.status] ?? detail.run.status}
          </Badge>
        }
      />

      <Panel className="p-5">
        <PanelHeader
          title="Ordered stops"
          description="A journey from stop a to b claims every segment in [a, b)."
          icon={<TrainFront className="h-4 w-4" />}
        />
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {detail.stops.map((stop, index) => (
            <li key={`${stop.code}-${stop.stopIndex}`} className="flex items-center gap-2">
              <div className="rounded-chip border border-line-light bg-subtle/60 px-3 py-2">
                <p className="rv-mono text-[10px] text-ink-muted">STOP {stop.stopIndex}</p>
                <p className="text-sm font-semibold">{stop.code}</p>
                <p className="text-[10px] text-ink-muted">
                  {stop.name} · +{stop.offsetMinutes} min
                </p>
              </div>
              {index < detail.stops.length - 1 ? (
                <span aria-hidden="true" className="text-ink-muted">→</span>
              ) : null}
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader
            title="Coaches on this run"
            description={`${detail.coaches.length} coach${detail.coaches.length === 1 ? "" : "es"} instantiated from templates.`}
            icon={<Armchair className="h-4 w-4" />}
          />
          <div className="mt-4 space-y-3">
            {detail.coaches.length === 0 ? (
              <p className="rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
                No coaches yet. Add one below to start selling seats on this run.
              </p>
            ) : (
              detail.coaches.map((coach) => (
                <div
                  key={coach.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-small border border-line-light bg-white/40 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {coach.coachCode}
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {TRAVEL_CLASS_LABELS[coach.travelClass]}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {coach.templateCode} · {coach.seats} seats · {coach.claimCount} segment claims
                      · {coach.bookedSeats} seats sold
                    </p>
                  </div>
                  <InlineActionForm
                    action={removeRunCoachAction}
                    hidden={{ runCoachId: coach.id, runId: detail.run.id }}
                    label="Remove coach"
                    confirmText={`Remove empty coach ${coach.coachCode}? Bookings block removal.`}
                    variant="ghost-light"
                  />
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Add a coach"
            description="Adding instantiates every template seat as a run seat. Templates already on the run are hidden."
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={addRunCoachAction}
              hidden={{ runId: detail.run.id }}
              submitLabel="Add coach to run"
              fields={[
                {
                  name: "templateId",
                  label: "Coach template",
                  type: "select",
                  required: true,
                  options: availableTemplates.map((template) => ({
                    value: template.id,
                    label: `${template.code} — ${TRAVEL_CLASS_LABELS[template.travelClass]} · ${template.totalSeats} seats`,
                  })),
                },
                { name: "coachCode", label: "Coach code", placeholder: "B2", required: true },
              ]}
            />
            {availableTemplates.length === 0 ? (
              <p className="mt-3 text-xs text-warning-ink">
                Every existing template is already on this run. Create another template on the{" "}
                <a className="underline underline-offset-2" href="/admin/coaches">
                  coach templates page
                </a>
                .
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Coach × segment occupancy"
          description="Confirmed bookings only. Cells are seats claimed on that half-open travel segment."
        />
        <div className="mt-4">
          <OccupancyMatrix
            coaches={matrix.coaches}
            segmentLabels={segments.map((segment) => `${segment.from.code}→${segment.to.code}`)}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Segment load"
          description="Seat claims against total physical seats on the run."
        />
        <div className="mt-4 rv-scroll">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Segment occupancy for this run</caption>
            <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th scope="col" className="py-2">Segment</th>
                <th scope="col" className="py-2">Journey</th>
                <th scope="col" className="py-2">Booked seats</th>
                <th scope="col" className="py-2">Capacity</th>
                <th scope="col" className="py-2">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <tr key={segment.segmentIndex} className="border-t border-line-light/70">
                  <td className="rv-mono py-2.5 text-xs">S{segment.segmentIndex}</td>
                  <td className="py-2.5 text-xs">
                    {segment.from.code} → {segment.to.code}
                  </td>
                  <td className="rv-mono py-2.5 text-xs">{segment.bookedSeats}</td>
                  <td className="rv-mono py-2.5 text-xs">{segment.capacity}</td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line-light">
                        <span
                          className="block h-full rounded-full bg-accent-ink"
                          style={{ width: `${Math.min(100, segment.occupancyPct)}%` }}
                        />
                      </span>
                      <span className="rv-mono text-xs">{segment.occupancyPct}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
