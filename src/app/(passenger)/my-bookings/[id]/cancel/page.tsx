import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { getBookingDetail } from "@/lib/domain/reservations";
import { requireUserPage } from "@/lib/page-auth";
import { formatFullDate, formatTime, msRemaining } from "@/lib/datetime";
import { formatInr } from "@/lib/utils";
import { CancelBookingForm } from "@/components/passenger/cancel-form";
import { Alert, Badge, Panel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cancel booking" };
export const dynamic = "force-dynamic";

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUserPage(`/my-bookings/${id}/cancel`);
  let detail: Awaited<ReturnType<typeof getBookingDetail>>;
  try {
    detail = await getBookingDetail(id);
  } catch {
    notFound();
  }
  if (detail.booking.userId !== user.id) redirect("/my-bookings");

  const future = msRemaining(detail.run.departureAt) > 0;
  const closed = detail.booking.status !== "confirmed" || !future;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/my-bookings/${detail.booking.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Back to ticket
      </Link>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Cancellation
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold">Cancel this booking?</h1>
        <p className="mt-2 text-sm text-fg-muted">
          {detail.train.name} · {formatFullDate(detail.run.departureAt)} ·{" "}
          {formatTime(detail.run.departureAt)} · {detail.fromStop?.code} →{" "}
          {detail.toStop?.code}
        </p>
      </div>

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="rv-mono text-lg font-semibold">{detail.booking.reference}</p>
          <Badge tone="neutral">{formatInr(detail.booking.totalFarePaise)}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Seats:{" "}
          {detail.seats.map((seat) => `${seat.coachCode} · ${seat.seatNumber}`).join(", ") ||
            "Released"}
        </p>

        <div className="mt-5">
          {closed ? (
            <Alert tone="warning" title="Self-service cancellation is closed">
              {detail.booking.status === "cancelled"
                ? "This booking is already cancelled. Repeating the request is safe but changes nothing."
                : "The train has departed. Contact operations if a disruption requires intervention."}
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/my-bookings/${detail.booking.id}`}>Return to ticket</Link>
                </Button>
              </div>
            </Alert>
          ) : (
            <CancelBookingForm bookingId={detail.booking.id} />
          )}
        </div>
      </Panel>

      <Panel className="p-4">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          RAILVYN’s cancellation policy is defined by this demo: self-service while
          the run has not departed. There is no cancellation fee and no real refund;
          the simulated payment is marked refunded for audit completeness.
        </p>
      </Panel>
    </div>
  );
}
