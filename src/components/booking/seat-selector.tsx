"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Accessibility,
  Armchair,
  Check,
  Info,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { createSeatHoldAction } from "@/actions/booking";
import type { CoachView, SeatStatus, SeatView } from "@/lib/domain/availability";
import { cn, formatInr, TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { berthedLabel } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState, Panel } from "@/components/ui/surfaces";
import { Checkbox, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/client-primitives";

const STATUS_LABEL: Record<SeatStatus, string> = {
  available: "available",
  held: "held by another passenger",
  booked: "already booked",
};

const BERTH_SHORT = {
  lower: "L",
  middle: "M",
  upper: "U",
  side_lower: "SL",
  side_upper: "SU",
  seat: "C",
} as const;

export function SeatSelector({
  runId,
  from,
  to,
  travelClass,
  passengerCount,
  coaches,
  farePerPassengerPaise,
  isAuthenticated,
  nextPath,
}: {
  runId: string;
  from: number;
  to: number;
  travelClass: "sleeper" | "ac3" | "ac2" | "chair";
  passengerCount: number;
  coaches: CoachView[];
  farePerPassengerPaise: number;
  isAuthenticated: boolean;
  nextPath: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [overrides, setOverrides] = React.useState<Record<string, SeatStatus>>({});
  const [accessibleOnly, setAccessibleOnly] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);

  const allSeats = React.useMemo(
    () => coaches.flatMap((coach) => coach.seats),
    [coaches],
  );
  const seatById = React.useMemo(
    () => new Map(allSeats.map((seat) => [seat.id, seat])),
    [allSeats],
  );

  const statusOf = (seat: SeatView): SeatStatus => overrides[seat.id] ?? seat.status;
  const selectedSeats = selected
    .map((id) => seatById.get(id))
    .filter((seat): seat is SeatView => Boolean(seat));

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(
        `/api/runs/${runId}/availability?from=${from}&to=${to}&travelClass=${travelClass}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Availability refresh failed.");
      const payload = (await response.json()) as {
        checkedAt: string;
        seats: Array<{ id: string; status: SeatStatus }>;
      };
      const nextOverrides: Record<string, SeatStatus> = {};
      for (const seat of payload.seats) nextOverrides[seat.id] = seat.status;
      setOverrides((previous) => ({ ...previous, ...nextOverrides }));
      setCheckedAt(payload.checkedAt);
      const taken = selected.filter(
        (id) => (nextOverrides[id] ?? seatById.get(id)?.status) !== "available",
      );
      if (taken.length > 0) {
        setSelected((previous) => previous.filter((id) => !taken.includes(id)));
        setNotice(
          "A seat you had selected was taken. It has been removed from your selection — pick another.",
        );
      }
    } catch {
      // Keep the last known state; the hold transaction is the real guard.
      setNotice("Could not refresh availability. The server still revalidates on hold.");
    } finally {
      setRefreshing(false);
    }
  }, [from, runId, seatById, selected, to, travelClass]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  function toggle(seat: SeatView) {
    if (statusOf(seat) !== "available") {
      setNotice(
        seat.status === "held"
          ? "That seat is currently held by another passenger. Try another or refresh."
          : "That seat is already booked for your journey segment.",
      );
      return;
    }
    setError(null);
    setSelected((previous) => {
      if (previous.includes(seat.id)) {
        return previous.filter((id) => id !== seat.id);
      }
      if (previous.length >= passengerCount) {
        setNotice(
          `You requested ${passengerCount} seat${passengerCount === 1 ? "" : "s"}. Deselect one before adding another.`,
        );
        return previous;
      }
      setNotice(null);
      return [...previous, seat.id];
    });
  }

  async function hold(useAutoPick: boolean) {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createSeatHoldAction({
        runId,
        from,
        to,
        travelClass,
        passengerCount,
        seatIds: useAutoPick ? undefined : selected,
      });
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      router.push(
        `/book/${runId}/passengers?hold=${result.holdId}`,
      );
    } catch {
      setError("The seats could not be held. Check the coach map and try again.");
      setPending(false);
    }
  }

  const total = farePerPassengerPaise * passengerCount;

  if (coaches.length === 0) {
    return (
      <Panel className="p-6">
        <EmptyState
          title="No coach in this class"
          description="This run does not have a coach for the selected class. Choose another class from the run page."
          icon={<Armchair className="h-5 w-5" />}
        />
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Panel className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Coach explorer</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {TRAVEL_CLASS_LABELS[travelClass]} · {passengerCount} passenger
              {passengerCount === 1 ? "" : "s"} · seats shown for segments {from}–{to - 1}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <span className="text-[11px] text-ink-muted" aria-live="polite">
              {checkedAt
                ? `Checked ${new Date(checkedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}`
                : "Auto-refresh every 10s"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-small border border-line-light bg-subtle/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] border border-line-light bg-white" aria-hidden="true" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] bg-accent-ink" aria-hidden="true" />
              Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rv-hatch h-3 w-3 rounded-[4px] border border-warning-ink/30 bg-warning" aria-hidden="true" />
              Held
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[4px] bg-line-light" aria-hidden="true" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              <Accessibility aria-hidden="true" className="h-3.5 w-3.5" />
              Accessible berth
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="accessible-only"
              label={<span className="text-xs">Accessible berths only</span>}
              checked={accessibleOnly}
              onCheckedChange={setAccessibleOnly}
            />
          </div>
        </div>

        {notice ? (
          <div className="mt-3">
            <Alert tone="warning">{notice}</Alert>
          </div>
        ) : null}
        {error ? (
          <div className="mt-3">
            <Alert tone="danger" title="Seats not held">
              {error}
            </Alert>
          </div>
        ) : null}

        <Tabs defaultValue="map" className="mt-4">
          <TabsList>
            <TabsTrigger value="map">
              <LayoutGrid aria-hidden="true" className="h-3.5 w-3.5" />
              Coach diagram
            </TabsTrigger>
            <TabsTrigger value="list">
              <List aria-hidden="true" className="h-3.5 w-3.5" />
              Readable seat list
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <div className="space-y-5">
              {coaches.map((coach) => {
                const rows = new Map<number, SeatView[]>();
                for (const seat of coach.seats) {
                  if (accessibleOnly && !seat.isAccessible) continue;
                  const row = rows.get(seat.rowIndex) ?? [];
                  row.push(seat);
                  rows.set(seat.rowIndex, row);
                }
                const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
                const freeCount = coach.seats.filter((seat) => statusOf(seat) === "available").length;
                return (
                  <div key={coach.id} className="rounded-small border border-line-light p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">{coach.code}</Badge>
                        <span className="text-sm font-semibold">{coach.templateName}</span>
                        <span className="text-xs text-ink-muted">{coach.layoutStyle}</span>
                      </div>
                      <span className="rv-mono text-xs text-ink-muted">
                        {freeCount} free · {coach.seats.length} seats
                      </span>
                    </div>
                    {ordered.length === 0 ? (
                      <p className="mt-3 text-xs text-ink-muted">
                        No accessible berths in this coach. Clear the accessibility filter.
                      </p>
                    ) : (
                      <div className="rv-scroll mt-3">
                        <div className="min-w-max space-y-1.5">
                          {ordered.map(([rowIndex, rowSeats]) => (
                            <div key={rowIndex} className="flex items-center gap-1.5">
                              <span className="rv-mono w-6 shrink-0 text-[10px] text-ink-muted">
                                {rowIndex}
                              </span>
                              {rowSeats
                                .sort((a, b) => a.positionInRow - b.positionInRow)
                                .map((seat, index) => {
                                  const status = statusOf(seat);
                                  const isSelected = selected.includes(seat.id);
                                  const label = `Coach ${coach.code}, seat ${seat.seatNumber}, ${berthedLabel(seat.berthType)}, ${isSelected ? "selected" : STATUS_LABEL[status]}${seat.isAccessible ? ", accessible" : ""}`;
                                  return (
                                    <React.Fragment key={seat.id}>
                                      {index === 3 || (index === 4 && rowSeats.length === 6) ? (
                                        <span
                                          aria-hidden="true"
                                          className="mx-1 h-8 w-px bg-line-light"
                                        />
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => toggle(seat)}
                                        disabled={status !== "available"}
                                        aria-pressed={isSelected}
                                        aria-label={label}
                                        title={label}
                                        className={cn(
                                          "relative flex h-11 w-11 flex-col items-center justify-center rounded-[7px] border text-[11px] font-semibold transition-colors",
                                          status === "available" && !isSelected
                                            ? "border-line-light bg-white text-ink hover:border-ink hover:bg-subtle"
                                            : status === "held"
                                              ? "rv-hatch cursor-not-allowed border-warning-ink/30 bg-warning text-warning-ink"
                                              : status === "booked"
                                                ? "cursor-not-allowed border-line-light/60 bg-line-light/60 text-ink-muted line-through"
                                                : "border-accent-ink bg-accent-ink text-accent",
                                        )}
                                      >
                                        <span className="rv-mono leading-none">{seat.seatNumber}</span>
                                        <span className="mt-0.5 text-[8px] font-medium uppercase leading-none opacity-80">
                                          {BERTH_SHORT[seat.berthType]}
                                        </span>
                                        {seat.isAccessible ? (
                                          <Accessibility
                                            aria-hidden="true"
                                            className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-panel p-0.5 text-ink"
                                          />
                                        ) : null}
                                        {isSelected ? (
                                          <Check
                                            aria-hidden="true"
                                            className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent p-0.5 text-accent-ink"
                                          />
                                        ) : null}
                                      </button>
                                    </React.Fragment>
                                  );
                                })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-ink-muted">
                      {coach.layoutStyle} · aisle shown as a vertical rule. Use the
                      readable list for exact seat names.
                    </p>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="rv-scroll rounded-small border border-line-light">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">
                  Accessible seat list with availability for your journey
                </caption>
                <thead className="bg-subtle/70 text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Coach</th>
                    <th scope="col" className="px-3 py-2">Seat</th>
                    <th scope="col" className="px-3 py-2">Berth</th>
                    <th scope="col" className="px-3 py-2">Access</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                    <th scope="col" className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allSeats
                    .filter((seat) => !accessibleOnly || seat.isAccessible)
                    .map((seat) => {
                      const status = statusOf(seat);
                      const isSelected = selected.includes(seat.id);
                      return (
                        <tr key={seat.id} className="border-t border-line-light/70">
                          <td className="px-3 py-2 font-semibold">{seat.coachCode}</td>
                          <td className="rv-mono px-3 py-2">{seat.seatNumber}</td>
                          <td className="px-3 py-2 text-xs">{berthedLabel(seat.berthType)}</td>
                          <td className="px-3 py-2 text-xs">
                            {seat.isAccessible ? (
                              <span className="inline-flex items-center gap-1">
                                <Accessibility aria-hidden="true" className="h-3.5 w-3.5" />
                                Accessible
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <Badge
                              tone={
                                isSelected
                                  ? "accent"
                                  : status === "available"
                                    ? "success"
                                    : status === "held"
                                      ? "warning"
                                      : "neutral"
                              }
                            >
                              {isSelected ? "Selected" : status === "available" ? "Available" : status === "held" ? "Held" : "Booked"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={isSelected ? "primary" : "outline"}
                              disabled={status !== "available"}
                              onClick={() => toggle(seat)}
                              aria-label={`${isSelected ? "Deselect" : "Select"} coach ${seat.coachCode} seat ${seat.seatNumber}`}
                            >
                              {isSelected ? (
                                <>
                                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                                  Remove
                                </>
                              ) : (
                                "Select"
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] text-ink-muted">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Preferences, including adjacency, are honoured when feasible and are
          never a guarantee. The server allocates under a per-run lock and the
          unique claim index is authoritative.
        </p>
      </Panel>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <Panel className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Your selection
              </p>
              <p className="mt-1 text-sm font-semibold">
                {selectedSeats.length} of {passengerCount} selected
              </p>
            </div>
            <Armchair aria-hidden="true" className="h-4 w-4 text-ink-muted" />
          </div>
          {selectedSeats.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {selectedSeats.map((seat) => (
                <li
                  key={seat.id}
                  className="flex items-center justify-between gap-2 rounded-chip border border-line-light/80 bg-white/50 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-semibold">
                    {seat.coachCode} · {seat.seatNumber}
                  </span>
                  <span className="text-ink-muted">{berthedLabel(seat.berthType)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-chip border border-dashed border-line-light p-3 text-xs text-ink-muted">
              No seats selected. Choose berths from the map or let RAILVYN pick
              the best available.
            </p>
          )}
          <dl className="mt-4 space-y-2 border-t border-line-light pt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Fare / passenger</dt>
              <dd className="rv-mono font-semibold">{formatInr(farePerPassengerPaise)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-ink-muted">Passengers</dt>
              <dd className="rv-mono font-semibold">{passengerCount}</dd>
            </div>
            <div className="flex justify-between gap-2 text-sm">
              <dt className="font-semibold">Demo total</dt>
              <dd className="rv-mono font-semibold">{formatInr(total)}</dd>
            </div>
          </dl>
          <div className="mt-4 space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={pending || (selected.length > 0 && selected.length !== passengerCount)}
              onClick={() => void hold(false)}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="h-4 w-4" />
              )}
              {selected.length === 0
                ? "Select seats to continue"
                : pending
                  ? "Holding seats…"
                  : `Hold ${selected.length} seat${selected.length === 1 ? "" : "s"}`}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => void hold(true)}
            >
              {pending ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="h-4 w-4" />
              )}
              Auto-pick best available
            </Button>
            {!isAuthenticated ? (
              <p className="text-[11px] text-ink-muted">
                You will be asked to sign in before a hold is created.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Holding claims every segment between your stations. Checkout must be
            completed before the hold expires; no payment details are collected.
          </p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Seat status key
          </p>
          <ul className="mt-2 space-y-1.5 text-[11px] text-ink-muted">
            <li>L · lower · M · middle · U · upper</li>
            <li>SL · side lower · SU · side upper · C · chair</li>
            <li className="flex items-center gap-1.5">
              <Accessibility aria-hidden="true" className="h-3.5 w-3.5" />
              Accessible berth marker
            </li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
