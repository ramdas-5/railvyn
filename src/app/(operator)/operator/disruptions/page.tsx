import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listOperatorTrainIds } from "@/lib/permissions";
import { getOperatorDisruptions } from "@/lib/queries/operator";
import { getUpcomingRunsForOperator } from "@/lib/domain/analytics";
import {
  createDisruptionAction,
  resolveDisruptionAction,
} from "@/actions/operator";
import { formatDateTime } from "@/lib/datetime";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { InlineActionForm } from "@/components/forms/inline-action-form";

export const metadata: Metadata = { title: "Disruption log" };
export const dynamic = "force-dynamic";

const SEVERITY_TONE = {
  info: "neutral",
  warning: "warning",
  critical: "danger",
} as const;

export default async function OperatorDisruptionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator/disruptions");
  if (!user.isOperator) return <AccessDenied />;

  const trainIds = await listOperatorTrainIds(user);
  const [disruptions, runs] = await Promise.all([
    getOperatorDisruptions(trainIds),
    getUpcomingRunsForOperator(trainIds, 40),
  ]);
  const open = disruptions.filter((disruption) => !disruption.resolvedAt);
  const runOptions = runs.map((run) => ({
    value: run.runId,
    label: `${run.trainCode} · ${run.serviceDate} · ${run.trainName}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations"
        title="Disruption log"
        description="Incidents are scoped to your assigned runs. Non-info incidents flag the run as disrupted; resolving the last open incident restores it to scheduled."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        <Panel className="p-5">
          <PanelHeader
            title="Record an incident"
            description="Every incident writes an audit entry. Never include unnecessary passenger personal data."
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <div className="mt-4">
            {runOptions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No upcoming runs in scope. Incidents cannot be logged without an
                operable run.
              </p>
            ) : (
              <ActionForm
                action={createDisruptionAction}
                submitLabel="Publish incident"
                fields={[
                  {
                    name: "runId",
                    label: "Train run",
                    type: "select",
                    options: runOptions,
                    required: true,
                    colSpan: 2,
                  },
                  {
                    name: "title",
                    label: "Short title",
                    required: true,
                    placeholder: "Signal failure near CNB",
                    colSpan: 2,
                  },
                  {
                    name: "severity",
                    label: "Severity",
                    type: "select",
                    options: [
                      { value: "info", label: "Info — no run flag" },
                      { value: "warning", label: "Warning — flag run" },
                      { value: "critical", label: "Critical — flag run" },
                    ],
                    defaultValue: "warning",
                    required: true,
                  },
                  {
                    name: "description",
                    label: "Operational impact",
                    type: "textarea",
                    required: true,
                    placeholder: "Expected delay, affected segment, actions taken…",
                    colSpan: 2,
                  },
                ]}
              />
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Incident history"
            description={`${open.length} open · ${disruptions.length} total in scope.`}
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <div className="mt-4">
            {disruptions.length === 0 ? (
              <EmptyState
                title="No incidents logged"
                description="Operational disruptions will appear here with their audit history."
                icon={<TriangleAlert className="h-5 w-5" />}
              />
            ) : (
              <ul className="space-y-3">
                {disruptions.map((disruption) => (
                  <li
                    key={disruption.id}
                    className="rounded-small border border-line-light p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{disruption.title}</p>
                        <p className="text-xs text-ink-muted">
                          {disruption.trainCode} · {disruption.trainName} ·{" "}
                          {disruption.serviceDate}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERITY_TONE[disruption.severity]}>
                          {disruption.severity}
                        </Badge>
                        <Badge tone={disruption.resolvedAt ? "success" : "warning"} dot>
                          {disruption.resolvedAt ? "Resolved" : "Open"}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">{disruption.description}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
                      <span>
                        Raised {formatDateTime(disruption.createdAt)}
                        {disruption.createdByName
                          ? ` by ${disruption.createdByName}`
                          : " by operations"}
                        {disruption.resolvedAt
                          ? ` · resolved ${formatDateTime(disruption.resolvedAt)}`
                          : ""}
                      </span>
                      {disruption.resolvedAt ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                          Restored when last incident closes
                        </span>
                      ) : (
                        <InlineActionForm
                          action={resolveDisruptionAction}
                          hidden={{ disruptionId: disruption.id }}
                          label="Resolve incident"
                          confirmText="Mark this incident resolved? The run returns to scheduled only when no incidents remain open."
                          variant="outline"
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
