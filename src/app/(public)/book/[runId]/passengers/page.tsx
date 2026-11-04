import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, IdCard, TriangleAlert } from "lucide-react";
import { getHoldDetail } from "@/lib/domain/allocation";
import { getSessionUser } from "@/lib/auth";
import { msRemaining } from "@/lib/datetime";
import { HoldCountdown } from "@/components/booking/hold-countdown";
import { PassengerForm } from "@/components/booking/passenger-form";
import { TripSummary } from "@/components/booking/trip-summary";
import { Alert, Panel, PanelHeader } from "@/components/ui/surfaces";
import { DatabaseNotice } from "@/components/database-notice";

export const metadata: Metadata = { title: "Traveller details" };
export const dynamic = "force-dynamic";

export default async function PassengersPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ hold?: string }>;
}) {
  const session = await getSessionUser();
  const { runId } = await params;
  const { hold: holdId } = await searchParams;
  if (!session) {
    const next = `/book/${runId}/passengers${holdId ? `?hold=${holdId}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!holdId) redirect(`/trains/${runId}`);

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
  const defaults = {
    passengers:
      draft?.passengers?.map((passenger) => ({
        fullName: passenger.fullName,
        age: passenger.age,
        gender: (passenger.gender as "female" | "male" | "other") ?? "female",
      })) ??
      Array.from({ length: detail.hold.passengerCount }, () => ({
        fullName: "",
        age: 30,
        gender: "female" as const,
      })),
    contactEmail: draft?.contactEmail ?? session.email,
    contactPhone: draft?.contactPhone ?? "",
  };

  const backHref = `/book/${runId}/seats?from=${detail.hold.fromStopIndex}&to=${detail.hold.toStopIndex}&travelClass=${detail.hold.travelClass}&passengers=${detail.hold.passengerCount}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        Back to seat selection
      </Link>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
          Step 2 of 3 · Traveller details
        </p>
        <h1 className="mt-1.5 text-3xl font-semibold">Who is travelling?</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Enter a name, age and gender for each held seat. Your hold expires in{" "}
          {Math.max(0, Math.round(msRemaining(detail.hold.expiresAt) / 60000))} minute(s);
          the timer below is authoritative.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="space-y-4">
          {expired ? (
            <Alert tone="danger" title="This hold has expired">
              Seats were released back to inventory.{" "}
              <Link href={backHref} className="underline underline-offset-2">
                Select seats again
              </Link>
              .
            </Alert>
          ) : (
            <HoldCountdown expiresAt={detail.hold.expiresAt.toISOString()} />
          )}
          <Panel className="p-5 sm:p-6">
            <PanelHeader
              title="Passenger information"
              description="Names as they should appear on the internal RAILVYN ticket. No identity documents are stored."
              icon={<IdCard className="h-4 w-4" />}
            />
            <div className="mt-5">
              {expired ? (
                <p className="text-sm text-ink-muted">
                  Traveller details are closed because the hold is no longer active.
                </p>
              ) : (
                <PassengerForm
                  holdId={detail.hold.id}
                  passengerCount={detail.hold.passengerCount}
                  defaults={defaults}
                />
              )}
            </div>
          </Panel>
          <Panel className="p-4">
            <p className="flex items-start gap-2 text-[11px] text-ink-muted">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              All-or-nothing group policy: every held seat must convert together. If
              any claim is lost, confirmation fails and you return to seat selection.
            </p>
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
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
          <Panel className="p-4">
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Simulation only. RAILVYN does not generate official PNRs, does not
              connect to Indian Railways inventory, and never charges a real card.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
