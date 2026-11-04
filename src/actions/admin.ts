"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getDb } from "@/db";
import {
  account,
  coachTemplates,
  fares,
  operatorScopes,
  roleAssignments,
  routeStops,
  routes,
  runCoaches,
  runSeats,
  session,
  seatSegmentClaims,
  stations,
  templateSeats,
  trainRuns,
  trains,
  user,
  type BerthType,
  type TravelClass,
} from "@/db/schema";
import {
  assertNotRemovingLastAdmin,
  requireAdmin,
} from "@/lib/permissions";
import { writeAudit } from "@/lib/domain/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { savePolicy } from "@/lib/settings";
import { kolkataToUtc } from "@/lib/datetime";
import {
  coachTemplateSchema,
  fareSchema,
  operatorScopeSchema,
  resetPasswordSchema,
  roleAssignmentSchema,
  routeSchema,
  routeStopSchema,
  runCoachSchema,
  runSchema,
  settingsSchema,
  stationSchema,
  trainSchema,
} from "@/lib/validation";
import {
  actionError,
  actionSuccess,
  zodActionError,
  type ActionState,
} from "@/lib/action-result";

function adminRole(actor: { isAdmin: boolean }): string {
  return actor.isAdmin ? "admin" : "operator";
}

export async function createStationAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = stationSchema.safeParse({
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: formData.get("name"),
      city: formData.get("city"),
      state: formData.get("state"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [station] = await getDb()
      .insert(stations)
      .values(parsed.data)
      .returning({ id: stations.id });
    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "station.created",
      entityType: "station",
      entityId: station?.id ?? null,
      metadata: { code: parsed.data.code },
    });
    revalidatePath("/admin/network");
    return actionSuccess(`Station ${parsed.data.code} created.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function createRouteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = routeSchema.safeParse({
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: formData.get("name"),
      description: formData.get("description") ?? "",
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [route] = await getDb()
      .insert(routes)
      .values({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .returning({ id: routes.id });
    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "route.created",
      entityType: "route",
      entityId: route?.id ?? null,
      metadata: { code: parsed.data.code },
    });
    revalidatePath("/admin/network");
    return actionSuccess(`Route ${parsed.data.code} created. Add its ordered stops next.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function addRouteStopAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = routeStopSchema.safeParse({
      routeId: formData.get("routeId"),
      stationId: formData.get("stationId"),
      distanceKm: formData.get("distanceKm"),
      scheduledOffsetMinutes: formData.get("scheduledOffsetMinutes"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const db = getDb();
    const existing = await db
      .select({
        stopIndex: routeStops.stopIndex,
        distanceKm: routeStops.distanceKm,
        offsetMinutes: routeStops.scheduledOffsetMinutes,
      })
      .from(routeStops)
      .where(eq(routeStops.routeId, parsed.data.routeId))
      .orderBy(routeStops.stopIndex);

    if (existing.length >= 24) {
      throw new ValidationError("A route cannot have more than 24 stops.");
    }
    const last = existing[existing.length - 1];
    if (last) {
      if (parsed.data.distanceKm <= last.distanceKm) {
        throw new ValidationError("Distance must increase along the route.");
      }
      if (parsed.data.scheduledOffsetMinutes <= last.offsetMinutes) {
        throw new ValidationError("Scheduled offset must increase along the route.");
      }
    }
    if (existing.some((stop) => stop.stopIndex === existing.length)) {
      throw new ConflictError("The stop order is inconsistent; reload the page.");
    }

    await db.insert(routeStops).values({
      routeId: parsed.data.routeId,
      stationId: parsed.data.stationId,
      stopIndex: existing.length,
      distanceKm: parsed.data.distanceKm,
      scheduledOffsetMinutes: parsed.data.scheduledOffsetMinutes,
    });
    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "route.stop_added",
      entityType: "route",
      entityId: parsed.data.routeId,
      metadata: { stopIndex: existing.length, stationId: parsed.data.stationId },
    });
    revalidatePath("/admin/network");
    return actionSuccess("Stop appended to the route.");
  } catch (error) {
    return actionError(error);
  }
}

export async function createTrainAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = trainSchema.safeParse({
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: formData.get("name"),
      routeId: formData.get("routeId"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [train] = await getDb()
      .insert(trains)
      .values(parsed.data)
      .returning({ id: trains.id });
    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "train.created",
      entityType: "train",
      entityId: train?.id ?? null,
      metadata: { code: parsed.data.code },
    });
    revalidatePath("/admin/trains");
    revalidatePath("/admin/runs");
    return actionSuccess(`Train ${parsed.data.code} created.`);
  } catch (error) {
    return actionError(error);
  }
}

const DEFAULT_COACH_CODE: Record<TravelClass, string> = {
  sleeper: "S1",
  ac3: "B1",
  ac2: "A1",
  chair: "C1",
};

export async function generateRunAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = runSchema.safeParse({
      trainId: formData.get("trainId"),
      serviceDate: formData.get("serviceDate"),
      departureHour: formData.get("departureHour"),
      departureMinute: formData.get("departureMinute"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const db = getDb();
    const [train] = await db
      .select({ id: trains.id, routeId: trains.routeId, code: trains.code, name: trains.name })
      .from(trains)
      .where(eq(trains.id, parsed.data.trainId))
      .limit(1);
    if (!train) throw new NotFoundError("That train was not found.");

    const stops = await db
      .select({
        offsetMinutes: routeStops.scheduledOffsetMinutes,
      })
      .from(routeStops)
      .where(eq(routeStops.routeId, train.routeId))
      .orderBy(routeStops.stopIndex);
    if (stops.length < 2) {
      throw new ValidationError("Add at least two ordered stops to the route first.");
    }

    const departureAt = kolkataToUtc(
      parsed.data.serviceDate,
      parsed.data.departureHour * 60 + parsed.data.departureMinute,
    );
    if (departureAt.getTime() <= Date.now()) {
      throw new ValidationError("Choose a future departure for a new run.");
    }
    const arrivalAt = new Date(
      departureAt.getTime() + stops[stops.length - 1]!.offsetMinutes * 60_000,
    );

    const templates = await db
      .select()
      .from(coachTemplates)
      .orderBy(asc(coachTemplates.code));
    const templateByClass = new Map<TravelClass, (typeof templates)[number]>();
    for (const template of templates) {
      if (!templateByClass.has(template.travelClass)) {
        templateByClass.set(template.travelClass, template);
      }
    }

    let createdRunId = "";
    await db.transaction(async (tx) => {
      const [run] = await tx
        .insert(trainRuns)
        .values({
          trainId: train.id,
          serviceDate: parsed.data.serviceDate,
          departureAt,
          arrivalAt,
          status: "scheduled",
        })
        .returning({ id: trainRuns.id });
      createdRunId = run!.id;

      let position = 1;
      for (const [travelClass, template] of templateByClass) {
        const [coach] = await tx
          .insert(runCoaches)
          .values({
            runId: run!.id,
            templateId: template.id,
            coachCode: DEFAULT_COACH_CODE[travelClass],
            position,
            travelClass,
          })
          .returning({ id: runCoaches.id });
        const seats = await tx
          .select()
          .from(templateSeats)
          .where(eq(templateSeats.templateId, template.id))
          .orderBy(templateSeats.seatNumber);
        if (seats.length > 0) {
          await tx.insert(runSeats).values(
            seats.map((seat) => ({
              runCoachId: coach!.id,
              seatNumber: seat.seatNumber,
              berthType: seat.berthType,
              deck: seat.deck,
              rowIndex: seat.rowIndex,
              positionInRow: seat.positionInRow,
              isAccessible: seat.isAccessible,
            })),
          );
        }
        position += 1;
      }

      await writeAudit(
        {
          actorUserId: actor.id,
          actorRole: adminRole(actor),
          action: "run.created",
          entityType: "train_run",
          entityId: run!.id,
          metadata: {
            trainCode: train.code,
            serviceDate: parsed.data.serviceDate,
            coaches: templateByClass.size,
          },
        },
        tx,
      );
    });

    revalidatePath("/admin/runs");
    revalidatePath("/search");
    return actionSuccess(
      templateByClass.size > 0
        ? `Run created with ${templateByClass.size} coach class(es).`
        : "Run created. Add coach templates and coaches to sell seats.",
    );
  } catch (error) {
    return actionError(error);
  }
}

export async function createCoachTemplateAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = coachTemplateSchema.safeParse({
      code: String(formData.get("code") ?? "").trim().toUpperCase(),
      name: formData.get("name"),
      travelClass: formData.get("travelClass"),
      layoutStyle: formData.get("layoutStyle"),
      bays: formData.get("bays"),
      berthsPerBay: formData.get("berthsPerBay"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const patterns: Record<TravelClass, BerthType[]> = {
      sleeper: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
      ac3: ["lower", "middle", "upper", "lower", "middle", "upper", "side_lower", "side_upper"],
      ac2: ["lower", "upper", "lower", "upper", "side_lower", "side_upper"],
      chair: ["seat", "seat", "seat", "seat", "seat", "seat"],
    };
    const pattern = patterns[parsed.data.travelClass];
    const totalSeats = parsed.data.bays * parsed.data.berthsPerBay;
    if (totalSeats > 240) {
      throw new ValidationError("A coach template cannot exceed 240 seats.");
    }

    const db = getDb();
    let templateId = "";
    await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(coachTemplates)
        .values({
          code: parsed.data.code,
          name: parsed.data.name,
          travelClass: parsed.data.travelClass,
          layoutStyle: parsed.data.layoutStyle,
          totalSeats,
        })
        .returning({ id: coachTemplates.id });
      templateId = template!.id;

      await tx.insert(templateSeats).values(
        Array.from({ length: totalSeats }, (_, index) => ({
          templateId: template!.id,
          seatNumber: index + 1,
          berthType: pattern[index % pattern.length]!,
          deck: "lower",
          rowIndex: Math.floor(index / parsed.data.berthsPerBay) + 1,
          positionInRow: (index % parsed.data.berthsPerBay) + 1,
          isAccessible:
            index < 2 && (parsed.data.travelClass !== "chair" || index === 0),
        })),
      );

      await writeAudit(
        {
          actorUserId: actor.id,
          actorRole: adminRole(actor),
          action: "coach_template.created",
          entityType: "coach_template",
          entityId: template!.id,
          metadata: { code: parsed.data.code, totalSeats },
        },
        tx,
      );
    });

    revalidatePath("/admin/coaches");
    return actionSuccess(`Coach template ${parsed.data.code} created with ${totalSeats} seats.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function addRunCoachAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = runCoachSchema.safeParse({
      runId: formData.get("runId"),
      templateId: formData.get("templateId"),
      coachCode: String(formData.get("coachCode") ?? "").trim().toUpperCase(),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const db = getDb();
    const [template] = await db
      .select()
      .from(coachTemplates)
      .where(eq(coachTemplates.id, parsed.data.templateId))
      .limit(1);
    if (!template) throw new NotFoundError("That coach template was not found.");

    const existing = await db
      .select({ position: runCoaches.position })
      .from(runCoaches)
      .where(eq(runCoaches.runId, parsed.data.runId));

    await db.transaction(async (tx) => {
      const [coach] = await tx
        .insert(runCoaches)
        .values({
          runId: parsed.data.runId,
          templateId: template.id,
          coachCode: parsed.data.coachCode,
          position: Math.max(0, ...existing.map((row) => row.position)) + 1,
          travelClass: template.travelClass,
        })
        .returning({ id: runCoaches.id });
      const seats = await tx
        .select()
        .from(templateSeats)
        .where(eq(templateSeats.templateId, template.id))
        .orderBy(templateSeats.seatNumber);
      if (seats.length > 0) {
        await tx.insert(runSeats).values(
          seats.map((seat) => ({
            runCoachId: coach!.id,
            seatNumber: seat.seatNumber,
            berthType: seat.berthType,
            deck: seat.deck,
            rowIndex: seat.rowIndex,
            positionInRow: seat.positionInRow,
            isAccessible: seat.isAccessible,
          })),
        );
      }
      await writeAudit(
        {
          actorUserId: actor.id,
          actorRole: adminRole(actor),
          action: "run.coach_added",
          entityType: "train_run",
          entityId: parsed.data.runId,
          metadata: { coachCode: parsed.data.coachCode, templateCode: template.code },
        },
        tx,
      );
    });

    revalidatePath(`/admin/runs/${parsed.data.runId}`);
    return actionSuccess("Coach added to the run.");
  } catch (error) {
    return actionError(error);
  }
}

export async function removeRunCoachAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = z
      .object({ runCoachId: z.uuid(), runId: z.uuid() })
      .safeParse({ runCoachId: formData.get("runCoachId"), runId: formData.get("runId") });
    if (!parsed.success) return zodActionError(parsed.error);

    const db = getDb();
    const [claim] = await db
      .select({ id: seatSegmentClaims.id })
      .from(seatSegmentClaims)
      .innerJoin(runSeats, eq(seatSegmentClaims.runSeatId, runSeats.id))
      .where(eq(runSeats.runCoachId, parsed.data.runCoachId))
      .limit(1);
    if (claim) {
      throw new ConflictError(
        "This coach has holds or bookings. Use controlled reassignment before removing it.",
      );
    }

    const [coach] = await db
      .select({ coachCode: runCoaches.coachCode, runId: runCoaches.runId })
      .from(runCoaches)
      .where(eq(runCoaches.id, parsed.data.runCoachId))
      .limit(1);
    if (!coach) throw new NotFoundError("That coach was not found.");

    await db.delete(runCoaches).where(eq(runCoaches.id, parsed.data.runCoachId));
    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "run.coach_removed",
      entityType: "train_run",
      entityId: coach.runId,
      metadata: { coachCode: coach.coachCode },
    });
    revalidatePath(`/admin/runs/${parsed.data.runId}`);
    return actionSuccess("Empty coach removed.");
  } catch (error) {
    return actionError(error);
  }
}

export async function upsertFareAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = fareSchema.safeParse({
      routeId: formData.get("routeId"),
      travelClass: formData.get("travelClass"),
      fromStopIndex: formData.get("fromStopIndex"),
      toStopIndex: formData.get("toStopIndex"),
      amountRupees: formData.get("amountRupees"),
    });
    if (!parsed.success) return zodActionError(parsed.error);
    if (parsed.data.fromStopIndex >= parsed.data.toStopIndex) {
      throw new ValidationError("The alighting stop must come after the boarding stop.");
    }

    const stopCount = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(routeStops)
      .where(eq(routeStops.routeId, parsed.data.routeId));
    if ((stopCount[0]?.count ?? 0) < 2) {
      throw new ValidationError("Add stops to the route before pricing it.");
    }

    await getDb()
      .insert(fares)
      .values({
        routeId: parsed.data.routeId,
        travelClass: parsed.data.travelClass,
        fromStopIndex: parsed.data.fromStopIndex,
        toStopIndex: parsed.data.toStopIndex,
        amountPaise: Math.round(parsed.data.amountRupees * 100),
      })
      .onConflictDoUpdate({
        target: [
          fares.routeId,
          fares.travelClass,
          fares.fromStopIndex,
          fares.toStopIndex,
        ],
        set: {
          amountPaise: Math.round(parsed.data.amountRupees * 100),
          updatedAt: new Date(),
        },
      });

    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: "fare.upserted",
      entityType: "route",
      entityId: parsed.data.routeId,
      metadata: {
        travelClass: parsed.data.travelClass,
        fromStopIndex: parsed.data.fromStopIndex,
        toStopIndex: parsed.data.toStopIndex,
        amountRupees: parsed.data.amountRupees,
      },
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/search");
    return actionSuccess("Fare saved.");
  } catch (error) {
    return actionError(error);
  }
}

export async function assignRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = roleAssignmentSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      action: formData.get("action"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    if (parsed.data.role === "admin" && parsed.data.action === "revoke") {
      await assertNotRemovingLastAdmin(parsed.data.userId, actor.id);
    }

    if (parsed.data.action === "grant") {
      await getDb()
        .insert(roleAssignments)
        .values({
          userId: parsed.data.userId,
          role: parsed.data.role,
          grantedBy: actor.id,
        })
        .onConflictDoNothing();
    } else {
      await getDb()
        .delete(roleAssignments)
        .where(
          and(
            eq(roleAssignments.userId, parsed.data.userId),
            eq(roleAssignments.role, parsed.data.role),
          ),
        );
    }

    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: `role.${parsed.data.action}`,
      entityType: "user",
      entityId: parsed.data.userId,
      metadata: { role: parsed.data.role },
    });
    revalidatePath("/admin/users");
    return actionSuccess(`Role ${parsed.data.role} ${parsed.data.action}ed.`);
  } catch (error) {
    return actionError(error);
  }
}

export async function operatorScopeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = operatorScopeSchema.safeParse({
      userId: formData.get("userId"),
      trainId: formData.get("trainId"),
      action: formData.get("action"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    if (parsed.data.action === "grant") {
      const [operatorRole] = await getDb()
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.userId, parsed.data.userId),
            eq(roleAssignments.role, "operator"),
          ),
        )
        .limit(1);
      if (!operatorRole) {
        throw new ValidationError("Grant the operator role before assigning train scopes.");
      }
      await getDb()
        .insert(operatorScopes)
        .values({ userId: parsed.data.userId, trainId: parsed.data.trainId })
        .onConflictDoNothing();
    } else {
      await getDb()
        .delete(operatorScopes)
        .where(
          and(
            eq(operatorScopes.userId, parsed.data.userId),
            eq(operatorScopes.trainId, parsed.data.trainId),
          ),
        );
    }

    await writeAudit({
      actorUserId: actor.id,
      actorRole: adminRole(actor),
      action: `operator_scope.${parsed.data.action}`,
      entityType: "user",
      entityId: parsed.data.userId,
      metadata: { trainId: parsed.data.trainId },
    });
    revalidatePath("/admin/users");
    return actionSuccess("Operator scope updated.");
  } catch (error) {
    return actionError(error);
  }
}

export async function resetUserPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = resetPasswordSchema.safeParse({
      userId: formData.get("userId"),
      newPassword: formData.get("newPassword"),
    });
    if (!parsed.success) return zodActionError(parsed.error);

    const [existingUser] = await getDb()
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, parsed.data.userId))
      .limit(1);
    if (!existingUser) throw new NotFoundError("That user was not found.");

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const updated = await getDb()
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, parsed.data.userId),
          eq(account.providerId, "credential"),
        ),
      )
      .returning({ id: account.id });
    if (updated.length === 0) {
      throw new ValidationError("This account has no password credential to reset.");
    }

    await getDb().delete(session).where(eq(session.userId, parsed.data.userId));
    await writeAudit({
      actorUserId: actor.id,
      actorRole: "admin",
      action: "user.password_reset",
      entityType: "user",
      entityId: parsed.data.userId,
      metadata: { email: existingUser.email },
    });
    revalidatePath("/admin/users");
    return actionSuccess("Password reset. Existing sessions were signed out.");
  } catch (error) {
    return actionError(error);
  }
}

export async function saveSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = settingsSchema.safeParse({
      holdTtlSeconds: formData.get("holdTtlSeconds"),
      waitlistOfferTtlSeconds: formData.get("waitlistOfferTtlSeconds"),
      maxSeatsPerBooking: formData.get("maxSeatsPerBooking"),
      allowWaitlist: formData.get("allowWaitlist") === "on",
    });
    if (!parsed.success) return zodActionError(parsed.error);

    await savePolicy("holdTtlSeconds", parsed.data.holdTtlSeconds);
    await savePolicy("waitlistOfferTtlSeconds", parsed.data.waitlistOfferTtlSeconds);
    await savePolicy("maxSeatsPerBooking", parsed.data.maxSeatsPerBooking);
    await savePolicy("allowWaitlist", parsed.data.allowWaitlist);

    await writeAudit({
      actorUserId: actor.id,
      actorRole: "admin",
      action: "settings.updated",
      entityType: "app_settings",
      entityId: "booking_policy",
      metadata: { ...parsed.data },
    });
    revalidatePath("/admin/settings");
    return actionSuccess("Booking policy saved.");
  } catch (error) {
    return actionError(error);
  }
}
