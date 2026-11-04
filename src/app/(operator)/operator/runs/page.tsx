import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, TrainFront } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listOperatorTrainIds } from "@/lib/permissions";
import { getUpcomingRunsForOperator } from "@/lib/domain/analytics";
import { formatDate, formatTime } from "@/lib/datetime";
import { STATUS_LABELS } from "@/lib/utils";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel } from "@/components/ui/surfaces";

export const metadata: Metadata = { title: "Assigned runs" };
export const dynamic = "force-dynamic";

export default async function OperatorRunsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator/runs");
  if (!user.isOperator) return <AccessDenied />;

  const trainIds = await listOperatorTrainIds(user);
  const runs = await getUpcomingRunsForOperator(trainIds, 40);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operations"
        title="Assigned runs"
        description="Dated services inside your scope. Each console shows segment occupancy, live holds, bookings, waitlists and incident controls."
      />

      <Panel className="p-5">
        {runs.length === 0 ? (
          <EmptyState
            title="No assigned runs"
            description="Your role is active but no train scopes or upcoming runs are assigned. Contact an administrator."
            icon={<TrainFront className="h-5 w-5" />}
          />
        ) : (
          <div className="rv-scroll">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Assigned upcoming runs</caption>
              <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th scope="col" className="py-2">Train</th>
                  <th scope="col" className="py-2">Service date</th>
                  <th scope="col" className="py-2">Departure</th>
                  <th scope="col" className="py-2">Bookings</th>
                  <th scope="col" className="py-2">Seats</th>
                  <th scope="col" className="py-2">Status</th>
                  <th scope="col" className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.runId} className="border-t border-line-light/70">
                    <td className="py-3">
                      <span className="font-semibold">{run.trainCode}</span>
                      <span className="block text-[11px] text-ink-muted">{run.trainName}</span>
                    </td>
                    <td className="rv-mono py-3 text-xs">{run.serviceDate}</td>
                    <td className="py-3 text-xs">
                      {formatDate(run.departureAt)} · {formatTime(run.departureAt)}
                    </td>
                    <td className="rv-mono py-3">{run.bookings}</td>
                    <td className="rv-mono py-3 text-xs">
                      {run.seatsSold}/{run.capacity}
                    </td>
                    <td className="py-3">
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
                    <td className="py-3 text-right">
                      <Link
                        href={`/operator/runs/${run.runId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2"
                      >
                        Open console
                        <ArrowRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
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
