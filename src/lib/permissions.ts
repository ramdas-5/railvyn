import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { operatorScopes, trains, trainRuns, roleAssignments } from "@/db/schema";
import type { AppRole } from "@/db/schema";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(role: AppRole): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.roles.includes(role)) throw new ForbiddenError();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("admin");
}

export async function requireOperator(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isOperator) throw new ForbiddenError();
  return user;
}

/** True when the actor is an admin or has an explicit scope on the train. */
export async function canOperateTrain(
  user: SessionUser,
  trainId: string,
): Promise<boolean> {
  if (user.isAdmin) return true;
  if (!user.roles.includes("operator")) return false;
  const [scope] = await getDb()
    .select({ id: operatorScopes.id })
    .from(operatorScopes)
    .where(
      and(eq(operatorScopes.userId, user.id), eq(operatorScopes.trainId, trainId)),
    )
    .limit(1);
  return Boolean(scope);
}

/** Resolves the run's train and enforces operator scoping (admins bypass). */
export async function requireOperatorForRun(
  user: SessionUser,
  runId: string,
): Promise<{ trainId: string }> {
  const [row] = await getDb()
    .select({ trainId: trains.id })
    .from(trainRuns)
    .innerJoin(trains, eq(trainRuns.trainId, trains.id))
    .where(eq(trainRuns.id, runId))
    .limit(1);
  if (!row) throw new NotFoundError("That train run was not found.");
  const allowed = await canOperateTrain(user, row.trainId);
  if (!allowed) throw new ForbiddenError("This run is outside your operator scope.");
  return row;
}

export async function listOperatorTrainIds(user: SessionUser): Promise<string[] | "all"> {
  if (user.isAdmin) return "all";
  const rows = await getDb()
    .select({ trainId: operatorScopes.trainId })
    .from(operatorScopes)
    .where(eq(operatorScopes.userId, user.id));
  return rows.map((row) => row.trainId);
}

/** Prevents an admin from removing the last admin role from themselves. */
export async function assertNotRemovingLastAdmin(
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  if (targetUserId !== actorUserId) return;
  const admins = await getDb()
    .select({ userId: roleAssignments.userId })
    .from(roleAssignments)
    .where(eq(roleAssignments.role, "admin"));
  if (admins.filter((row) => row.userId !== targetUserId).length === 0) {
    throw new ForbiddenError("You cannot remove the final administrator role.");
  }
}
