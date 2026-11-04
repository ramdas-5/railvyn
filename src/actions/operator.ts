"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bookings, disruptions, trainRuns } from "@/db/schema";
import { requireOperator, requireOperatorForRun } from "@/lib/permissions";
import { writeAudit } from "@/lib/domain/audit";
import { cancelBooking, reassignBookingSeats } from "@/lib/domain/reservations";
import { cancelWaitlistEntry, setWaitlistPriority } from "@/lib/domain/waitlist";
import { NotFoundError } from "@/lib/errors";
import {
  disruptionSchema,
  reassignSchema,
} from "@/lib/validation";
import {
  actionError,
  actionSuccess,
  zodActionError,
  type ActionState,
} from "@/lib/action-result";

export async function createDisruptionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const parsed = disruptionSchema.safeParse({
      runId: formData.get("runId"),
      title: formData.get("title"),
      description: formData.get("description"),
      severity: formData.get("severity"),
    });
    if (!parsed.success) return zodActionError(parsed.error);
    await requireOperatorForRun(actor, parsed.data.runId);

    await getDb().transaction(async (tx) => {
      const [disruption] = await tx
        .insert(disruptions)
        .values({
          runId: parsed.data.runId,
          title: parsed.data.title,
          description: parsed.data.description,
          severity: parsed.data.severity,
          createdBy: actor.id,
        })
        .returning({ id: disruptions.id });
      if (parsed.data.severity !== "info") {
        await tx
          .update(trainRuns)
          .set({ status: "disrupted" })
          .where(eq(trainRuns.id, parsed.data.runId));
      }
      await writeAudit(
        {
          actorUserId: actor.id,
          actorRole: actor.isAdmin ? "admin" : "operator",
          action: "disruption.created",
          entityType: "disruption",
          entityId: disruption?.id ?? null,
          metadata: {
            runId: parsed.data.runId,
            severity: parsed.data.severity,
            title: parsed.data.title,
          },
        },
        tx,
      );
    });

    revalidatePath("/operator");
    revalidatePath("/operator/disruptions");
    revalidatePath(`/operator/runs/${parsed.data.runId}`);
    return actionSuccess("Disruption recorded and the run was flagged.");
  } catch (error) {
    return actionError(error);
  }
}

export async function resolveDisruptionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const disruptionId = z.uuid().parse(formData.get("disruptionId"));
    const [record] = await getDb()
      .select({ id: disruptions.id, runId: disruptions.runId })
      .from(disruptions)
      .where(eq(disruptions.id, disruptionId))
      .limit(1);
    if (!record) throw new NotFoundError("That disruption was not found.");
    await requireOperatorForRun(actor, record.runId);

    await getDb().transaction(async (tx) => {
      await tx
        .update(disruptions)
        .set({ resolvedAt: new Date() })
        .where(and(eq(disruptions.id, disruptionId), isNull(disruptions.resolvedAt)));
      const remaining = await tx
        .select({ id: disruptions.id })
        .from(disruptions)
        .where(and(eq(disruptions.runId, record.runId), isNull(disruptions.resolvedAt)))
        .limit(1);
      if (remaining.length === 0) {
        await tx
          .update(trainRuns)
          .set({ status: "scheduled" })
          .where(and(eq(trainRuns.id, record.runId), eq(trainRuns.status, "disrupted")));
      }
      await writeAudit(
        {
          actorUserId: actor.id,
          actorRole: actor.isAdmin ? "admin" : "operator",
          action: "disruption.resolved",
          entityType: "disruption",
          entityId: disruptionId,
          metadata: { runId: record.runId },
        },
        tx,
      );
    });

    revalidatePath("/operator/disruptions");
    return actionSuccess("Disruption resolved.");
  } catch (error) {
    return actionError(error);
  }
}

export async function reassignSeatsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const parsed = reassignSchema.safeParse({
      bookingId: formData.get("bookingId"),
      seatIds: formData.getAll("seatIds").filter((value): value is string => typeof value === "string"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [booking] = await getDb()
      .select({ runId: bookings.runId })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId))
      .limit(1);
    if (!booking) throw new NotFoundError("That booking was not found.");
    await requireOperatorForRun(actor, booking.runId);

    const result = await reassignBookingSeats({
      bookingId: parsed.data.bookingId,
      newSeatIds: parsed.data.seatIds,
      actorUserId: actor.id,
      actorRole: actor.isAdmin ? "admin" : "operator",
      reason: parsed.data.reason,
    });

    revalidatePath(`/operator/runs/${booking.runId}`);
    return actionSuccess(`Seats moved to ${result.seats.join(", ")}.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function staffCancelBookingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const parsed = z
      .object({ bookingId: z.uuid(), reason: z.string().trim().min(4).max(240) })
      .safeParse({
        bookingId: formData.get("bookingId"),
        reason: formData.get("reason"),
      });
    if (!parsed.success) return zodActionError(parsed.error);

    const [booking] = await getDb()
      .select({ runId: bookings.runId })
      .from(bookings)
      .where(eq(bookings.id, parsed.data.bookingId))
      .limit(1);
    if (!booking) throw new NotFoundError("That booking was not found.");
    await requireOperatorForRun(actor, booking.runId);

    const result = await cancelBooking({
      bookingId: parsed.data.bookingId,
      actorUserId: actor.id,
      actorRole: actor.isAdmin ? "admin" : "operator",
      reason: parsed.data.reason,
      staffOverride: true,
    });

    revalidatePath(`/operator/runs/${booking.runId}`);
    revalidatePath("/operator/bookings");
    return result.alreadyCancelled
      ? actionSuccess("That booking was already cancelled.")
      : actionSuccess(`Booking ${result.reference} cancelled; waitlist promotion attempted.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function waitlistPriorityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const parsed = z
      .object({ entryId: z.uuid(), priority: z.coerce.number().int().min(0).max(5) })
      .safeParse({
        entryId: formData.get("entryId"),
        priority: formData.get("priority"),
      });
    if (!parsed.success) return zodActionError(parsed.error);
    await setWaitlistPriority({
      entryId: parsed.data.entryId,
      priority: parsed.data.priority,
      actorUserId: actor.id,
    });
    revalidatePath("/operator/waitlist");
    return actionSuccess("Waitlist priority updated.");
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelWaitlistAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireOperator();
    const entryId = z.uuid().parse(formData.get("entryId"));
    await cancelWaitlistEntry({
      entryId,
      actorUserId: actor.id,
      staffOverride: true,
    });
    revalidatePath("/operator/waitlist");
    return actionSuccess("Waitlist entry closed and any offer released.");
  } catch (error) {
    return actionError(error);
  }
}
