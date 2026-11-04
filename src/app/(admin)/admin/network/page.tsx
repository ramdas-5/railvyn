import type { Metadata } from "next";
import { Map, Plus, TrainFront } from "lucide-react";
import { getAdminRoutes, getAdminStations } from "@/lib/queries/admin";
import {
  addRouteStopAction,
  createRouteAction,
  createStationAction,
} from "@/actions/admin";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Network" };
export const dynamic = "force-dynamic";

export default async function AdminNetworkPage() {
  await requireAdminPage("/admin/network");
  const [stations, routes] = await Promise.all([
    getAdminStations(),
    getAdminRoutes(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Stations, routes and ordered stops."
        description="A route needs at least two stations before it can be priced or scheduled. Stop index is contiguous from 0; travel segment n covers stops n to n+1."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader
            title="Add a station"
            description="Station codes are unique and used throughout search and tickets."
            icon={<Map className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={createStationAction}
              submitLabel="Create station"
              fields={[
                { name: "code", label: "Station code", placeholder: "NDLS", required: true },
                { name: "name", label: "Station name", placeholder: "New Delhi", required: true },
                { name: "city", label: "City", placeholder: "New Delhi", required: true },
                { name: "state", label: "State", placeholder: "Delhi", required: true },
              ]}
            />
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Create a route"
            description="A route is an ordered stop pattern shared by trains. Stops are appended in order."
            icon={<TrainFront className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={createRouteAction}
              submitLabel="Create route"
              fields={[
                { name: "code", label: "Route code", placeholder: "NDLS-BPL-01", required: true },
                { name: "name", label: "Route name", placeholder: "Delhi → Bhopal", required: true },
                {
                  name: "description",
                  label: "Description (optional)",
                  type: "textarea",
                  colSpan: 2,
                  placeholder: "Corridor notes for operators",
                },
              ]}
            />
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Stations"
          description={`${stations.length} station${stations.length === 1 ? "" : "s"} in the network.`}
        />
        {stations.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No stations yet"
              description="Create at least two stations, then build a route from them."
              icon={<Map className="h-5 w-5" />}
            />
          </div>
        ) : (
          <div className="rv-scroll mt-4">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Stations in the network</caption>
              <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th scope="col" className="py-2">Code</th>
                  <th scope="col" className="py-2">Station</th>
                  <th scope="col" className="py-2">City</th>
                  <th scope="col" className="py-2">State</th>
                  <th scope="col" className="py-2">Timezone</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((station) => (
                  <tr key={station.id} className="border-t border-line-light/70">
                    <td className="rv-mono py-2.5 font-semibold">{station.code}</td>
                    <td className="py-2.5">{station.name}</td>
                    <td className="py-2.5 text-xs">{station.city}</td>
                    <td className="py-2.5 text-xs">{station.state}</td>
                    <td className="py-2.5 text-xs text-ink-muted">{station.timezone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="space-y-4">
        {routes.length === 0 ? (
          <Panel className="p-5">
            <EmptyState
              title="No routes yet"
              description="Create a route, then append its stops in travel order."
              icon={<TrainFront className="h-5 w-5" />}
            />
          </Panel>
        ) : (
          routes.map((route) => (
            <Panel key={route.id} className="p-5">
              <PanelHeader
                title={
                  <span>
                    {route.code}
                    <span className="ml-2 text-sm font-normal text-ink-muted">{route.name}</span>
                  </span>
                }
                description={
                  route.description ??
                  `${route.stops.length} stop${route.stops.length === 1 ? "" : "s"}. Segments are half-open ranges between consecutive stops.`
                }
                icon={<TrainFront className="h-4 w-4" />}
              />

              {route.stops.length > 0 ? (
                <ol className="mt-4 flex flex-wrap items-center gap-2">
                  {route.stops.map((stop, index) => (
                    <li key={stop.stationId} className="flex items-center gap-2">
                      <div className="rounded-chip border border-line-light bg-subtle/60 px-3 py-2">
                        <p className="rv-mono text-[10px] text-ink-muted">STOP {index}</p>
                        <p className="text-sm font-semibold">{stop.code}</p>
                        <p className="text-[10px] text-ink-muted">
                          {stop.distanceKm} km · +{stop.offsetMinutes} min
                        </p>
                      </div>
                      {index < route.stops.length - 1 ? (
                        <span aria-hidden="true" className="text-ink-muted">→</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
                  No stops yet. Add the first station below.
                </p>
              )}

              <div id={`route-${route.id}`} className="mt-5 border-t border-line-light/70 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Append the next stop
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Distance and scheduled offset must both increase. The next stop index will be{" "}
                  <span className="rv-mono font-semibold">{route.stops.length}</span>.
                </p>
                <div className="mt-3">
                  <ActionForm
                    action={addRouteStopAction}
                    hidden={{ routeId: route.id }}
                    submitLabel="Append stop"
                    fields={[
                      {
                        name: "stationId",
                        label: "Station",
                        type: "select",
                        required: true,
                        options: stations.map((station) => ({
                          value: station.id,
                          label: `${station.code} — ${station.name}`,
                        })),
                      },
                      {
                        name: "distanceKm",
                        label: "Cumulative distance (km)",
                        type: "number",
                        min: 0,
                        required: true,
                        defaultValue: route.stops.at(-1)?.distanceKm ?? 0,
                      },
                      {
                        name: "scheduledOffsetMinutes",
                        label: "Offset from departure (min)",
                        type: "number",
                        min: 0,
                        required: true,
                        defaultValue: route.stops.at(-1)?.offsetMinutes ?? 0,
                      },
                    ]}
                  />
                </div>
              </div>
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}
