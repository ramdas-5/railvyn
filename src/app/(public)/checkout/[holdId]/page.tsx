import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Clock3, Pencil, ShieldCheck } from "lucide-react";
import { getHoldDetail } from "@/lib/domain/allocation";
import { getSessionUser } from "@/lib/auth";
import { generateIdempotencyKey } from "@/lib/domain/reference";
import { formatFullDate, formatTime, msRemaining } from "@/lib/datetime";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { berthedLabel } from "@/lib/labels";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { CheckoutPanel } from "@/components/booking/checkout-panel";
import { TripSummary } from "@/components/booking/trip-summary";
import { Alert, DemoNotice, Panel, PanelHeader } from "@/components/ui/surfaces";
import { DatabaseNotice } from "@/components/database-notice";

export const metadata: Metadata = { title: "Demo checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ holdId: string }>;
}) {
  const { holdId } = await params;
  const session = await getSessionUser();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/checkout/${holdId}`)}`);

  let detail: Awaited<ReturnType<typeof getHoldDetail>>;
  try {
    detail = await getHoldDetail(holdId);
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <DatabaseNotice />
      </div>
    );
  }
  if (detail.hold.userId !== session.id) redirect("/dashboard");

  const expired =
    detail.hold.status !== "active" || msRemaining(detail.hold.expiresAt) <= 0;
  const fromStop = detail.details.stops[detail.hold.fromStopIndex]!;
  const toStop = detail.details.stops[detail.hold.toStopIndex]!;
  const draft = detail.hold.passengerDraft;
  const seatHref = `/book/${detail.hold.runId}/seats?from=${detail.hold.fromStopIndex}&to=${detail.hold.toStopIndex}&travelClass=${detail.hold.travelClass}&passengers=${detail.hold.passengerCount}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href={`/book/${detail.hold.runId}/passengers?hold=${detail.hold.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Edit traveller details
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            Step 3 of 3 · Demo checkout
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold">Review and confirm</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {detail.details.train.name} · {formatFullDate(detail.details.run.departureAt)} ·{" "}
            {TRAVEL_CLASS_LABELS[detail.hold.travelClass]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5 rounded-chip border border-line px-2.5 py-1.5">
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
            {formatTime(detail.hold.expiresAt)} expiry
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-chip border border-line px-2.5 py-1.5">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            Server-validated hold
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="space-y-4">
          {expired ? (
            <Alert tone="danger" title="This hold is no longer active">
              Its segment claims have been released.{" "}
              <Link href={seatHref} className="underline underline-offset-2">
                Select seats again
              </Link>{" "}
              to restart checkout.
            </Alert>
          ) : (
            <HoldCountdown expiresAt={detail.hold.expiresAt.toISOString()} />
          )}

          <Panel className="p-5 sm:p-6">
            <PanelHeader
              title="Journey & seats"
              description={`Segments ${detail.hold.fromStopIndex}–${detail.hold.toStopIndex - 1} · ${detail.hold.passengerCount} passenger${detail.hold.passengerCount === 1 ? "" : "s"}`}
            />
            <div className="mt-4">
              <TripSummary
                trainName={detail.details.train.name}
                trainCode={detail.details.train.code}
                departureAt={detail.details.run.departureAt}
                fromCode={fromStop.code}
                fromName={fromStop.name}
                toCode={toStop.code}
                toName={toStop.name}
                travelClass={detail.hold.travelClass}
                seats={detail.outcome.seats.map((seat) => ({
                  coachCode: seat.coachCode,
                  seatNumber: seat.seatNumber,
                  berthType: seat.berthType,
                  isAccessible: seat.isAccessible,
                }))}
                farePerPassengerPaise={detail.outcome.farePerPassengerPaise}
                passengerCount={detail.hold.passengerCount}
                totalFarePaise={detail.outcome.totalFarePaise}
                status="held"
              />
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Travellers</h2>
              <Link
                href={`/book/${detail.hold.runId}/passengers?hold=${detail.hold.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink underline underline-offset-2"
              >
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                Edit details
              </Link>
            </div>
            {draft?.passengers?.length ? (
              <ul className="mt-3 divide-y divide-line-light/70 rounded-small border border-line-light">
                {draft.passengers.map((passenger, index) => {
                  const seat = detail.outcome.seats[index];
                  return (
                    <li
                      key={`${passenger.fullName}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-semibold">{passenger.fullName}</span>
                        <span className="ml-2 text-xs text-ink-muted">
                          {passenger.age} yrs · {passenger.gender}
                        </span>
                      </span>
                      {seat ? (
                        <span className="rv-mono text-xs text-ink-muted">
                          {seat.coachCode} · {seat.seatNumber} · {berthedLabel(seat.berthType)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Alert tone="warning" className="mt-3" title="Traveller details are missing">
                <Link href={`/book/${detail.hold.runId}/passengers?hold=${detail.hold.id}`} className="underline underline-offset-2">
                  Enter traveller details
                </Link>{" "}
                before confirming this booking.
              </Alert>
            )}
            {draft?.contactEmail ? (
              <p className="mt-3 text-xs text-ink-muted">
                Contact: {draft.contactEmail}
                {draft.contactPhone ? ` · ${draft.contactPhone}` : ""}
              </p>
            ) : null}
          </Panel>

          <Panel className="p-5 sm:p-6">
            <PanelHeader
              title="Demo payment"
              description="The adapter records a simulated success. No card field exists anywhere in RAILVYN."
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">
                  {detail.hold.passengerCount} × {TRAVEL_CLASS_LABELS[detail.hold.travelClass]}
                </span>
                <span className="rv-mono">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(detail.outcome.farePerPassengerPaise / 100)}
                </span>
              </div>
              <div className="flex justify-between gap-2 border-t border-line-light pt-2 text-base font-semibold">
                <span>Total (demo)</span>
                <span className="rv-mono">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(detail.outcome.totalFarePaise / 100)}
                </span>
              </div>
            </div>
            <div className="mt-4">
              {draft?.passengers?.length && !expired ? (
                <CheckoutPanel
                  holdId={detail.hold.id}
                  idempotencyKey={generateIdempotencyKey("checkout")}
                  totalFarePaise={detail.outcome.totalFarePaise}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  Complete the traveller details to enable confirmation.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Panel className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              What happens on confirm
            </p>
            <ol className="mt-3 space-y-3 text-xs leading-relaxed text-ink-muted">
              <li className="flex gap-2">
                <span className="rv-mono text-ink">01</span>
                Per-run advisory lock; expired holds released inside the transaction.
              </li>
              <li className="flex gap-2">
                <span className="rv-mono text-ink">02</span>
                Booking, passengers, seat links and demo payment inserted atomically.
              </li>
              <li className="flex gap-2">
                <span className="rv-mono text-ink">03</span>
                Every segment claim transfers from hold to booking — never duplicated.
              </li>
              <li className="flex gap-2">
                <span className="rv-mono text-ink">04</span>
                An internal RVN- reference is issued. Repeated clicks return the same booking.
              </li>
            </ol>
          </Panel>
          <Panel className="p-4">
            <DemoNotice />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              Cancellation policy: self-service while the train has not departed.
              The demo payment is marked refunded; no real refund occurs.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
