"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bookings, seatHolds, trainRuns } from "@/db/schema";
import { requireUser } from "@/lib/permissions";
import { createHold, releaseHold } from "@/lib/domain/allocation";
import {
  cancelBooking,
  confirmHold,
} from "@/lib/domain/reservations";
import { joinWaitlist } from "@/lib/domain/waitlist";
import { generateIdempotencyKey } from "@/lib/domain/reference";
import { ValidationError } from "@/lib/errors";
import {
  cancelSchema,
  createHoldSchema,
  joinWaitlistSchema,
  passengersDraftSchema,
} from "@/lib/validation";
import {
  actionError,
  actionSuccess,
  zodActionError,
  type ActionState,
} from "@/lib/action-result";

export async function createSeatHoldAction(input: unknown): Promise<
  { ok: true; holdId: string; expiresAt: string } | { ok: false; error: string }
> {
  try {
    const actor = await requireUser();
    const parsed = createHoldSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your selection." };
    }
    const outcome = await createHold({
      userId: actor.id,
      runId: parsed.data.runId,
      fromStopIndex: parsed.data.from,
      toStopIndex: parsed.data.to,
      travelClass: parsed.data.travelClass,
      passengerCount: parsed.data.passengerCount,
      selectedSeatIds: parsed.data.seatIds,
      preferences: {
        accessibleOnly: parsed.data.accessibleOnly,
        berthType: parsed.data.berthPreference,
      },
      idempotencyKey: generateIdempotencyKey("hold"),
      actorRole: "passenger",
    });
    revalidatePath(`/book/${parsed.data.runId}/seats`);
    return { ok: true, holdId: outcome.holdId, expiresAt: outcome.expiresAt.toISOString() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "RedirectError"
          ? "Sign in to hold seats."
          : actionError(error).message ?? "The seats could not be held.",
    };
  }
}

async function loadOwnedHold(holdId: string, userId: string) {
  const [hold] = await getDb()
    .select()
    .from(seatHolds)
    .where(eq(seatHolds.id, holdId))
    .limit(1);
  if (!hold) throw new ValidationError("That seat hold no longer exists.");
  if (hold.userId !== userId) {
    throw new ValidationError("That seat hold belongs to another passenger.");
  }
  return hold;
}

export async function savePassengerDraftAction(input: unknown): Promise<{
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}> {
  try {
    const actor = await requireUser();
    const envelope = z
      .object({ holdId: z.uuid(), draft: passengersDraftSchema })
      .safeParse(input);
    if (!envelope.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of envelope.error.issues) {
        const key = issue.path.join(".") || "form";
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      return { ok: false, error: "Check the traveller details.", fieldErrors };
    }

    const hold = await loadOwnedHold(envelope.data.holdId, actor.id);
    if (hold.status !== "active" || hold.expiresAt.getTime() <= Date.now()) {
      return {
        ok: false,
        error: "That hold has expired. Return to the coach map and select seats again.",
      };
    }
    if (envelope.data.draft.passengers.length !== hold.passengerCount) {
      return {
        ok: false,
        error: `Enter details for exactly ${hold.passengerCount} passenger(s).`,
      };
    }

    await getDb()
      .update(seatHolds)
      .set({
        passengerDraft: {
          passengers: envelope.data.draft.passengers,
          contactEmail: envelope.data.draft.contactEmail,
          contactPhone: envelope.data.draft.contactPhone || undefined,
        },
      })
      .where(eq(seatHolds.id, hold.id));

    revalidatePath(`/checkout/${hold.id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error).message };
  }
}

export async function confirmBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null;
  try {
    const actor = await requireUser();
    const holdId = z.uuid().parse(formData.get("holdId"));
    const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
    if (!idempotencyKey) throw new ValidationError("Refresh the page and try again.");

    if (formData.get("demoAcknowledged") !== "on") {
      return {
        status: "error",
        message: "Confirm that you understand this is a demonstration payment.",
      };
    }

    const hold = await loadOwnedHold(holdId, actor.id);
    const draft = passengersDraftSchema.safeParse(hold.passengerDraft);
    if (!draft.success || draft.data.passengers.length !== hold.passengerCount) {
      return {
        status: "error",
        message: "Enter traveller details before confirming this booking.",
      };
    }

    const result = await confirmHold({
      userId: actor.id,
      actorRole: "passenger",
      holdId,
      passengers: draft.data.passengers,
      contactEmail: draft.data.contactEmail ?? actor.email,
      contactPhone: draft.data.contactPhone,
      idempotencyKey,
    });

    revalidatePath("/my-bookings");
    revalidatePath("/dashboard");
    redirectTo = `/booking/result?ref=${encodeURIComponent(result.reference)}`;
  } catch (error) {
    return actionError(error);
  }
  redirect(redirectTo);
}

export async function releaseHoldAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null;
  try {
    const actor = await requireUser();
    const holdId = z.uuid().parse(formData.get("holdId"));
    await releaseHold({ holdId, userId: actor.id });
    redirectTo = "/search";
  } catch (error) {
    return actionError(error);
  }
  redirect(redirectTo);
}

export async function cancelBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null;
  try {
    const actor = await requireUser();
    const parsed = cancelSchema.safeParse({
      bookingId: formData.get("bookingId"),
      reason: formData.get("reason") ?? "",
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [booking] = await getDb()
      .select({
        id: bookings.id,
        userId: bookings.userId,
        status: bookings.status,
        reference: bookings.reference,
        departureAt: trainRuns.departureAt,
      })
      .from(bookings)
      .innerJoin(trainRuns, eq(bookings.runId, trainRuns.id))
      .where(eq(bookings.id, parsed.data.bookingId))
      .limit(1);

    if (!booking) throw new ValidationError("That booking could not be found.");
    if (booking.userId !== actor.id) {
      throw new ValidationError("You can only cancel your own bookings.");
    }
    if (booking.departureAt.getTime() <= Date.now()) {
      throw new ValidationError(
        "This train has already departed; self-service cancellation is closed. Contact operations.",
      );
    }

    await cancelBooking({
      bookingId: booking.id,
      actorUserId: actor.id,
      actorRole: "passenger",
      reason: parsed.data.reason || undefined,
    });

    revalidatePath("/my-bookings");
    revalidatePath(`/my-bookings/${booking.id}`);
    revalidatePath("/dashboard");
    redirectTo = `/my-bookings/${booking.id}?cancelled=1`;
  } catch (error) {
    return actionError(error);
  }
  redirect(redirectTo);
}

export async function joinWaitlistAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireUser();
    const parsed = joinWaitlistSchema.safeParse({
      runId: formData.get("runId"),
      from: formData.get("from"),
      to: formData.get("to"),
      travelClass: formData.get("travelClass"),
      passengerCount: formData.get("passengerCount"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const result = await joinWaitlist({
      userId: actor.id,
      runId: parsed.data.runId,
      fromStopIndex: parsed.data.from,
      toStopIndex: parsed.data.to,
      travelClass: parsed.data.travelClass,
      passengerCount: parsed.data.passengerCount,
    });

    revalidatePath("/dashboard");
    revalidatePath("/my-bookings");
    return actionSuccess(
      result.created
        ? "You joined the waitlist. We will offer a seat here if one becomes available."
        : "You are already on this waitlist.",
    );
  } catch (error) {
    return actionError(error);
  }
}
