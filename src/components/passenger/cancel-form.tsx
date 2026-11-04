"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";
import { cancelBookingAction } from "@/actions/booking";
import { IDLE_ACTION } from "@/lib/action-result";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/surfaces";
import { Label, Textarea } from "@/components/ui/field";

export function CancelBookingForm({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useActionState(cancelBookingAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      {state.status === "error" ? (
        <Alert tone="danger" title="Cancellation not completed">
          {state.message}
        </Alert>
      ) : null}
      <div>
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea
          id="reason"
          name="reason"
          maxLength={240}
          placeholder="Change of plan, meeting finished early…"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Stored with the audit trail. Do not include sensitive personal data.
        </p>
      </div>
      <div className="rounded-small border border-danger-ink/20 bg-danger p-3 text-xs text-danger-ink">
        <p className="flex items-center gap-2 font-semibold">
          <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
          This releases every seat claim for this booking.
        </p>
        <p className="mt-1">
          The demo payment is marked refunded. No real money moves. Waitlist
          promotion may run immediately, so the seats can be offered to someone
          else before you leave this page.
        </p>
      </div>
      <SubmitButton variant="danger" pendingLabel="Cancelling…">
        Yes, cancel this demo booking
      </SubmitButton>
    </form>
  );
}
