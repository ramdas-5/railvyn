import type { Metadata } from "next";
import { TrainFront } from "lucide-react";
import { getAdminRoutes, getAdminTrains } from "@/lib/queries/admin";
import { createTrainAction } from "@/actions/admin";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Trains" };
export const dynamic = "force-dynamic";

export default async function AdminTrainsPage() {
  await requireAdminPage("/admin/trains");
  const [trains, routes] = await Promise.all([getAdminTrains(), getAdminRoutes()]);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Trains"
        description="A train binds a service code and name to a route. Dated runs are generated per train and service date; physical coaches belong to each run, never to the template shared across runs."
      />

      <Panel className="p-5">
        <PanelHeader
          title="Create a train"
          description="The route must already have at least two ordered stops before it can be scheduled."
          icon={<TrainFront className="h-4 w-4" />}
          action={<Badge tone="neutral">{trains.length} trains</Badge>}
        />
        <div className="mt-4">
          <ActionForm
            action={createTrainAction}
            submitLabel="Create train"
            fields={[
              { name: "code", label: "Train code", placeholder: "12451", required: true },
              { name: "name", label: "Train name", placeholder: "Shatabdi Express", required: true },
              {
                name: "routeId",
                label: "Route",
                type: "select",
                required: true,
                colSpan: 2,
                options: routes.map((route) => ({
                  value: route.id,
                  label: `${route.code} — ${route.name} (${route.stops.length} stops)`,
                })),
              },
            ]}
          />
        </div>
        {routes.length === 0 ? (
          <p className="mt-3 text-xs text-warning-ink">
            No routes exist yet. Create a route and its ordered stops on the{" "}
            <a className="underline underline-offset-2" href="/admin/network">
              network page
            </a>{" "}
            first.
          </p>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Train registry" icon={<TrainFront className="h-4 w-4" />} />
        <div className="mt-4">
          {trains.length === 0 ? (
            <EmptyState
              title="No trains yet"
              description="Create a train after defining a route with two or more stops."
              icon={<TrainFront className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">Trains in the network</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Code</th>
                    <th scope="col" className="py-2">Train</th>
                    <th scope="col" className="py-2">Route</th>
                    <th scope="col" className="py-2">Stops</th>
                    <th scope="col" className="py-2">Runs</th>
                    <th scope="col" className="py-2">State</th>
                  </tr>
                </thead>
                <tbody>
                  {trains.map((train) => (
                    <tr key={train.id} className="border-t border-line-light/70">
                      <td className="rv-mono py-2.5 font-semibold">{train.code}</td>
                      <td className="py-2.5">{train.name}</td>
                      <td className="py-2.5 text-xs">
                        {train.routeCode}
                        <span className="block text-[11px] text-ink-muted">{train.routeName}</span>
                      </td>
                      <td className="rv-mono py-2.5 text-xs">{train.stopCount}</td>
                      <td className="rv-mono py-2.5 text-xs">{train.runs}</td>
                      <td className="py-2.5">
                        <Badge tone={train.active ? "success" : "neutral"}>
                          {train.active ? "Active" : "Inactive"}
                        </Badge>
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
