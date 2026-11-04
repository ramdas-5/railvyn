import type { Metadata } from "next";
import { IndianRupee } from "lucide-react";
import { getAdminFares, getAdminRoutes } from "@/lib/queries/admin";
import { upsertFareAction } from "@/actions/admin";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatInr, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  await requireAdminPage("/admin/pricing");
  const [routes, fares] = await Promise.all([getAdminRoutes(), getAdminFares()]);
  const pricedRoutes = routes.filter((route) => route.stops.length >= 2);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Segment pricing"
        description="Fares are defined per route, class and ordered stop pair in INR. Allocation reads the stored amount; the UI never invents a price."
      />

      <Panel className="p-5">
        <PanelHeader
          title="Create or update a fare"
          description="Saving an existing route, class and stop pair updates the amount instead of duplicating it."
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <div className="mt-4">
          <ActionForm
            action={upsertFareAction}
            submitLabel="Save fare"
            fields={[
              {
                name: "routeId",
                label: "Route",
                type: "select",
                required: true,
                colSpan: 2,
                options: pricedRoutes.map((route) => ({
                  value: route.id,
                  label: `${route.code} — ${route.name} (${route.stops.length} stops)`,
                })),
              },
              {
                name: "travelClass",
                label: "Travel class",
                type: "select",
                required: true,
                options: Object.entries(TRAVEL_CLASS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
              {
                name: "amountRupees",
                label: "Fare (INR)",
                type: "number",
                min: 50,
                max: 100000,
                step: 1,
                required: true,
              },
              {
                name: "fromStopIndex",
                label: "From stop index",
                type: "number",
                min: 0,
                required: true,
              },
              {
                name: "toStopIndex",
                label: "To stop index",
                type: "number",
                min: 1,
                required: true,
              },
            ]}
          />
        </div>
        {pricedRoutes.length === 0 ? (
          <p className="mt-3 text-xs text-warning-ink">
            No route has two or more ordered stops yet. Build the network first.
          </p>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Stop index reference"
          description="Fare ranges use half-open travel segments: a fare from 0 to 3 covers segments 0, 1 and 2."
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {routes.map((route) => (
            <div key={route.id} className="rounded-small border border-line-light p-3">
              <p className="text-sm font-semibold">
                {route.code}
                <span className="ml-2 text-xs font-normal text-ink-muted">{route.name}</span>
              </p>
              {route.stops.length === 0 ? (
                <p className="mt-1 text-xs text-ink-muted">No stops configured.</p>
              ) : (
                <ol className="mt-2 space-y-1">
                  {route.stops.map((stop) => (
                    <li key={stop.stationId} className="flex items-center gap-2 text-xs">
                      <span className="rv-mono w-6 rounded bg-subtle px-1 text-center font-semibold">
                        {stop.stopIndex}
                      </span>
                      <span>{stop.code}</span>
                      <span className="text-ink-muted">{stop.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Fare table"
          description={`${fares.length} stored fare${fares.length === 1 ? "" : "s"}.`}
          icon={<IndianRupee className="h-4 w-4" />}
        />
        <div className="mt-4">
          {fares.length === 0 ? (
            <EmptyState
              title="No fares yet"
              description="Save a segment fare before selling seats on that route and class."
              icon={<IndianRupee className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">Fares by route and class</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Route</th>
                    <th scope="col" className="py-2">Class</th>
                    <th scope="col" className="py-2">Journey</th>
                    <th scope="col" className="py-2">Segments</th>
                    <th scope="col" className="py-2">Fare</th>
                    <th scope="col" className="py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {fares.map((fare) => (
                    <tr key={fare.id} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{fare.routeCode}</span>
                        <span className="block text-[11px] text-ink-muted">{fare.routeName}</span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {TRAVEL_CLASS_LABELS[fare.travelClass]}
                      </td>
                      <td className="py-2.5 text-xs">
                        {fare.fromCode} → {fare.toCode}
                      </td>
                      <td className="rv-mono py-2.5 text-xs">
                        [{fare.fromStopIndex}, {fare.toStopIndex})
                      </td>
                      <td className="rv-mono py-2.5 font-semibold">
                        {formatInr(fare.amountPaise)}
                      </td>
                      <td className="py-2.5 text-xs">
                        {formatDate(fare.updatedAt)}
                        <span className="block text-[10px] text-ink-muted">
                          {formatDateTime(fare.updatedAt)}
                        </span>
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
