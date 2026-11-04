"use client";

import * as React from "react";
import { Clock, TriangleAlert } from "lucide-react";
import { formatCountdown, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export function HoldCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const expiry = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remaining, setRemaining] = React.useState(() => Math.max(0, expiry - Date.now()));

  React.useEffect(() => {
    const tick = () => {
      const next = Math.max(0, expiry - Date.now());
      setRemaining(next);
      if (next === 0) onExpire?.();
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expiry, onExpire]);

  const expired = remaining === 0;
  const warning = remaining > 0 && remaining < 60_000;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-small border p-3",
        expired
          ? "border-danger-ink/25 bg-danger text-danger-ink"
          : warning
            ? "border-warning-ink/25 bg-warning text-warning-ink"
            : "border-line-light bg-white/60 text-ink",
      )}
    >
      {expired ? (
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
      ) : (
        <Clock aria-hidden="true" className="h-5 w-5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">
          {expired ? "Hold expired" : "Hold expires in"}
        </p>
        <p className="rv-mono text-xl font-semibold" aria-live="polite" aria-atomic="true">
          {expired ? "Seats released" : formatCountdown(remaining)}
        </p>
        <p className="text-[11px]">
          {expired
            ? "The server has released these claims. Return to the coach map to select again."
            : `Exactly at ${formatTime(new Date(expiry))} IST. A stale tab cannot confirm this hold.`}
        </p>
      </div>
    </div>
  );
}
