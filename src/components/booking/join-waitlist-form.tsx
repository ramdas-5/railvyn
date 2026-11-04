"use client";

import { useActionState } from "react";
import { ListOrdered, Loader2 } from "lucide-react";
import { joinWaitlistAction } from "@/actions/booking";
import { IDLE_ACTION } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/surfaces";

export function JoinWaitlistForm({
  runId,
  from,
  to,
  travelClass,
  passengerCount,
}: {
  runId: string;
  from: number;
  to: number;
  travelClass: string;
  passengerCount: number;
}) {
  const [state, formAction, pending] = useActionState(joinWaitlistAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="travelClass" value={travelClass} />
      <input type="hidden" name="passengerCount" value={passengerCount} />
      {state.status === "error" ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : state.status === "success" ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <ListOrdered aria-hidden="true" className="h-4 w-4" />
        )}
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
      <p className="text-[11px] text-ink-muted">
        FIFO within an app-defined priority category. An offer creates a short
        hold; it is not a confirmed seat until checkout completes.
      </p>
    </form>
  );
}
