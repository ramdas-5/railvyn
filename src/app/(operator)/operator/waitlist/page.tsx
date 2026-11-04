import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListOrdered, Timer, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listOperatorTrainIds } from "@/lib/permissions";
import { getOperatorWaitlist } from "@/lib/queries/operator";
import {
  cancelWaitlistAction,
  waitlistPriorityAction,
} from "@/actions/operator";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { STATUS_LABELS, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { InlineActionForm } from "@/components/forms/inline-action-form";

export const metadata: Metadata = { title: "Waitlist queue" };
export const dynamic = "force-dynamic";

export default async function OperatorWaitlistPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator/waitlist");
  if (!user.isOperator) return <AccessDenied />;

  const trainIds = await listOperatorTrainIds(user);
  const entries = await getOperatorWaitlist(trainIds);
  const open = entries.filter(
    (entry) => entry.status === "waiting" || entry.status === "offered",
  );

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations"
        title="Waitlist queue"
        description="FIFO inside an explicit priority category. Promotion creates a short-lived hold, never a direct booking; priority is app-defined and not an Indian Railways quota."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-small border border-line bg-raised p-4 text-fg">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fg-muted">Waiting</p>
          <p className="rv-mono mt-2 text-2xl font-semibold">
            {entries.filter((entry) => entry.status === "waiting").length}
          </p>
        </div>
        <div className="rounded-small border border-line bg-raised p-4 text-fg">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fg-muted">Offered</p>
          <p className="rv-mono mt-2 text-2xl font-semibold">
            {entries.filter((entry) => entry.status === "offered").length}
          </p>
        </div>
        <div className="rounded-small border border-line bg-raised p-4 text-fg">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fg-muted">
            Open total
          </p>
          <p className="rv-mono mt-2 text-2xl font-semibold">{open.length}</p>
        </div>
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Queue in scope"
          description="Higher priority first, then oldest request. A waiting entry can only be promoted when claims can be allocated for its exact leg."
          icon={<ListOrdered className="h-4 w-4" />}
        />
        <div className="mt-4">
          {entries.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              description="No passenger has joined a waitlist for your trains."
              icon={<ListOrdered className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[62rem] text-left text-sm">
                <caption className="sr-only">Waitlist entries in operator scope</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Passenger</th>
                    <th scope="col" className="py-2">Train / date</th>
                    <th scope="col" className="py-2">Leg</th>
                    <th scope="col" className="py-2">Class</th>
                    <th scope="col" className="py-2">Pax</th>
                    <th scope="col" className="py-2">Status</th>
                    <th scope="col" className="py-2">Priority</th>
                    <th scope="col" className="py-2">Offer expires</th>
                    <th scope="col" className="py-2 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{entry.passengerName}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {entry.passengerEmail}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {entry.trainCode}
                        <span className="block text-ink-muted">
                          {entry.trainName} · {formatDate(entry.departureAt)}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {entry.fromCode} → {entry.toCode}
                        <span className="block text-ink-muted">
                          requested {formatDate(entry.createdAt)}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {TRAVEL_CLASS_LABELS[entry.travelClass]}
                      </td>
                      <td className="rv-mono py-2.5">{entry.passengerCount}</td>
                      <td className="py-2.5">
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
                      </td>
                      <td className="py-2.5">
                        {entry.status === "waiting" ? (
                          <ActionForm
                            action={waitlistPriorityAction}
                            hidden={{ entryId: entry.id }}
                            compact
                            columns={1}
                            submitLabel="Set"
                            fields={[
                              {
                                name: "priority",
                                label: "Priority (0–5)",
                                type: "number",
                                min: 0,
                                max: 5,
                                defaultValue: entry.priority,
                                required: true,
                              },
                            ]}
                          />
                        ) : (
                          <span className="rv-mono">{entry.priority}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-xs">
                        {entry.offeredExpiresAt ? (
                          <span className="inline-flex items-center gap-1">
                            <Timer aria-hidden="true" className="h-3 w-3" />
                            {formatDateTime(entry.offeredExpiresAt)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {["waiting", "offered"].includes(entry.status) ? (
                          <InlineActionForm
                            action={cancelWaitlistAction}
                            hidden={{ entryId: entry.id }}
                            label="Close entry"
                            confirmText="Close this waitlist entry and release any offer?"
                            variant="ghost-light"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                            <X aria-hidden="true" className="h-3 w-3" />
                            closed
                          </span>
                        )}
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
