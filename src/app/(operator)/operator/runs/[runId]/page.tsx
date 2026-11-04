import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Armchair,
  TicketCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { canOperateTrain } from "@/lib/permissions";
import { getAdminRunDetail } from "@/lib/queries/admin";
import {
  getAvailableSeatsForLeg,
  getOperatorRunBookings,
  getOperatorRunDisruptions,
  getOperatorRunHolds,
} from "@/lib/queries/operator";
import { getRunCoachMatrix, getRunSegmentOccupancy } from "@/lib/domain/analytics";
import {
  createDisruptionAction,
  reassignSeatsAction,
  resolveDisruptionAction,
  staffCancelBookingAction,
} from "@/actions/operator";
import { formatDate, formatTime } from "@/lib/datetime";
import {
  BERTH_LABELS,
  formatInr,
  STATUS_LABELS,
  TRAVEL_CLASS_LABELS,
} from "@/lib/utils";
import { AccessDenied, PageHeading } from "@/components/layout/page-heading";
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  StatCard,
} from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { InlineActionForm } from "@/components/forms/inline-action-form";
import { OccupancyMatrix } from "@/components/operator/occupancy-matrix";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Run console" };
export const dynamic = "force-dynamic";

export default async function OperatorRunConsolePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/operator");
  if (!user.isOperator) return <AccessDenied />;

  const { runId } = await params;
  const detail = await getAdminRunDetail(runId);
  if (!detail) notFound();
  if (!(await canOperateTrain(user, detail.run.trainId))) {
    return (
      <AccessDenied
        title="This run is outside your operator scope"
        description="Authorization is checked on the server for this read and for every action shown below."
      />
    );
  }

  const [bookings, holds, incidents, segments, matrix] = await Promise.all([
    getOperatorRunBookings(runId),
    getOperatorRunHolds(runId),
    getOperatorRunDisruptions(runId),
    getRunSegmentOccupancy(runId),
    getRunCoachMatrix(runId),
  ]);

  const confirmed = bookings.filter((booking) => booking.status === "confirmed");
  const seatsByBooking = new Map(
    await Promise.all(
      confirmed.map(async (booking) => {
        const seats = await getAvailableSeatsForLeg(
          runId,
          booking.travelClass,
          booking.fromStopIndex,
          booking.toStopIndex,
        );
        return [booking.id, seats] as const;
      }),
    ),
  );

  const capacity = matrix.coaches.reduce((total, coach) => total + coach.capacity, 0);
  const seatsSold = confirmed.reduce((total, booking) => total + booking.passengerCount, 0);
  const openIncidents = incidents.filter((incident) => !incident.resolvedAt);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/operator/runs">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Assigned runs
          </Link>
        </Button>
      </div>

      <PageHeading
        eyebrow={`Run console · ${detail.run.routeCode}`}
        title={`${detail.run.trainCode} — ${detail.run.trainName}`}
        description={`${formatDate(detail.run.departureAt)} · departs ${formatTime(detail.run.departureAt)} · ${detail.stops.length} stops. Reassignment is guarded by the same segment-claim transaction as a new booking.`}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Physical seats"
          value={capacity}
          hint={`${matrix.coaches.length} coaches`}
          tone="dark"
          icon={<Armchair className="h-4 w-4" />}
        />
        <StatCard
          label="Confirmed bookings"
          value={confirmed.length}
          hint={`${seatsSold} passengers`}
          tone="dark"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Live holds"
          value={holds.length}
          hint="Unexpired only"
          tone="dark"
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="Open incidents"
          value={openIncidents.length}
          hint={`${incidents.length} total logged`}
          tone="dark"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Seats sold"
          value={seatsSold}
          hint="Passenger-seat records"
          tone="dark"
          icon={<Armchair className="h-4 w-4" />}
        />
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Coach × segment occupancy"
          description="Confirmed claims only. Hover a cell for the exact seats booked on that segment."
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
          title="Live holds"
          description="Expired holds are released lazily by allocation and confirmation transactions."
          icon={<Timer className="h-4 w-4" />}
        />
        <div className="mt-4">
          {holds.length === 0 ? (
            <p className="rounded-small border border-dashed border-line-light p-4 text-sm text-ink-muted">
              No active holds on this run.
            </p>
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Active holds on this run</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Passenger</th>
                    <th scope="col" className="py-2">Journey</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Class</th>
                    <th scope="col" className="py-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {holds.map((hold) => (
                    <tr key={hold.id} className="border-t border-line-light/70">
                      <td className="py-2.5">
                        <span className="font-semibold">{hold.passengerName}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {hold.passengerEmail}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {hold.fromCode} → {hold.toCode}
                      </td>
                      <td className="py-2.5 text-xs">{hold.seatLabels || "—"}</td>
                      <td className="py-2.5 text-xs">
                        {TRAVEL_CLASS_LABELS[hold.travelClass]}
                      </td>
                      <td className="py-2.5 text-xs">
                        {formatDate(hold.expiresAt)} · {formatTime(hold.expiresAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Bookings and seat reassignment"
          description="Move a confirmed booking only to seats free for its exact leg. Cancellations attempt a guarded waitlist promotion."
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <div className="mt-4 space-y-3">
          {bookings.length === 0 ? (
            <EmptyState
              title="No bookings on this run"
              description="Bookings appear here as soon as passengers confirm a demo checkout."
              icon={<TicketCheck className="h-5 w-5" />}
            />
          ) : (
            bookings.map((booking) => {
              const alternatives = seatsByBooking.get(booking.id) ?? [];
              return (
                <div
                  key={booking.id}
                  className="rounded-small border border-line-light bg-white/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="rv-mono text-sm font-semibold">{booking.reference}</p>
                      <p className="text-xs">
                        {booking.passengerName} · {booking.passengerEmail}
                      </p>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {booking.fromCode} → {booking.toCode} ·{" "}
                        {TRAVEL_CLASS_LABELS[booking.travelClass]} · {booking.passengerCount} pax ·{" "}
                        {booking.seatLabels || "seats pending"} · {formatInr(booking.totalFarePaise)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={booking.status === "confirmed" ? "success" : "danger"}>
                        {STATUS_LABELS[booking.status]}
                      </Badge>
                      {booking.status === "confirmed" ? (
                        <InlineActionForm
                          action={staffCancelBookingAction}
                          hidden={{
                            bookingId: booking.id,
                            reason: "Staff cancellation from run console",
                          }}
                          label="Cancel booking"
                          confirmText={`Cancel booking ${booking.reference}? Its claims are released and the waitlist is promoted where possible.`}
                          variant="ghost-light"
                        />
                      ) : null}
                    </div>
                  </div>

                  {booking.status === "confirmed" ? (
                    <details className="mt-3 border-t border-line-light/70 pt-3">
                      <summary className="cursor-pointer text-xs font-semibold">
                        Move seats for this booking
                      </summary>
                      <div className="mt-3 max-w-xl">
                        {alternatives.length === 0 ? (
                          <p className="text-xs text-ink-muted">
                            No seats are free for this exact leg right now. Cancel or wait for a
                            release before reassigning.
                          </p>
                        ) : (
                          <ActionForm
                            action={reassignSeatsAction}
                            hidden={{ bookingId: booking.id }}
                            submitLabel="Move selected seats"
                            columns={1}
                            fields={[
                              {
                                name: "seatIds",
                                label: "Free seats on this leg",
                                type: "checkboxes",
                                required: true,
                                help: "Select exactly one seat per passenger. Moving claims is transactional and audited.",
                                options: alternatives.map((seat) => ({
                                  value: seat.id,
                                  label: `${seat.coachCode} · seat ${seat.seatNumber} · ${
                                    BERTH_LABELS[seat.berthType]
                                  }${seat.isAccessible ? " · accessible" : ""}`,
                                })),
                              },
                              {
                                name: "reason",
                                label: "Reason for reassignment",
                                type: "textarea",
                                required: true,
                                placeholder: "Coach change, accessibility request, disruption…",
                              },
                            ]}
                          />
                        )}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader
            title="Record a disruption"
            description="Warning and critical incidents flag the run; the run returns to scheduled when all are resolved."
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={createDisruptionAction}
              hidden={{ runId: detail.run.id }}
              submitLabel="Record incident"
              fields={[
                {
                  name: "severity",
                  label: "Severity",
                  type: "select",
                  required: true,
                  options: [
                    { value: "info", label: "Info — does not flag the run" },
                    { value: "warning", label: "Warning — flags the run" },
                    { value: "critical", label: "Critical — flags the run" },
                  ],
                },
                {
                  name: "title",
                  label: "Incident title",
                  required: true,
                  placeholder: "Signal failure near Bhopal",
                },
                {
                  name: "description",
                  label: "Operational impact",
                  type: "textarea",
                  required: true,
                  colSpan: 2,
                  placeholder: "What changed, which segments are affected, and what passengers should expect.",
                },
              ]}
            />
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Incident log"
            description={`${openIncidents.length} open of ${incidents.length} recorded.`}
            icon={<TriangleAlert className="h-4 w-4" />}
          />
          <div className="mt-4 space-y-2">
            {incidents.length === 0 ? (
              <p className="text-sm text-ink-muted">No incidents recorded for this run.</p>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-small border border-line-light p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{incident.title}</p>
                      <p className="text-[11px] text-ink-muted">
                        {incident.severity} · {formatDate(incident.createdAt)} ·{" "}
                        {incident.createdByName ?? "System"}
                      </p>
                    </div>
                    {incident.resolvedAt ? (
                      <Badge tone="success">Resolved</Badge>
                    ) : (
                      <InlineActionForm
                        action={resolveDisruptionAction}
                        hidden={{ disruptionId: incident.id }}
                        label="Resolve"
                        confirmText="Mark this incident resolved? The run returns to scheduled when no incidents remain open."
                        variant="ghost-light"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">{incident.description}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
