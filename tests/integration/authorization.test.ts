import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { operatorScopes, roleAssignments, user } from "@/db/schema";
import { canOperateTrain, requireOperatorForRun } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { createFixture } from "./helpers";

const databaseUrl = process.env.NEON_DATABASE_URL;

async function createActor(role: "passenger" | "operator" | "admin") {
  const id = randomUUID();
  await getDb().insert(user).values({
    id,
    name: `Actor ${role}`,
    email: `${role}-${id.slice(0, 8)}@test.railvyn.local`,
  });
  if (role !== "passenger") {
    await getDb().insert(roleAssignments).values({ userId: id, role });
  }
  const actor: SessionUser = {
    id,
    name: `Actor ${role}`,
    email: `${role}-${id.slice(0, 8)}@test.railvyn.local`,
    emailVerified: true,
    roles: role === "passenger" ? ["passenger"] : ["passenger", role],
    isAdmin: role === "admin",
    isOperator: role === "operator" || role === "admin",
  };
  return actor;
}

describe.skipIf(!databaseUrl)("server-side authorization", () => {
  it("denies operators access to runs outside their assigned trains", async () => {
    const fixture = await createFixture(2);
    try {
      const operator = await createActor("operator");
      await getDb().insert(operatorScopes).values({
        userId: operator.id,
        trainId: fixture.trainId,
      });
      expect(await canOperateTrain(operator, fixture.trainId)).toBe(true);
      await expect(
        requireOperatorForRun(operator, fixture.runId),
      ).resolves.toEqual({ trainId: fixture.trainId });

      const unscoped = await createActor("operator");
      expect(await canOperateTrain(unscoped, fixture.trainId)).toBe(false);
      await expect(requireOperatorForRun(unscoped, fixture.runId)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it("allows administrators to operate any run", async () => {
    const fixture = await createFixture(2);
    try {
      const admin = await createActor("admin");
      expect(await canOperateTrain(admin, fixture.trainId)).toBe(true);
      await expect(requireOperatorForRun(admin, fixture.runId)).resolves.toEqual({
        trainId: fixture.trainId,
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not grant passenger accounts operator access", async () => {
    const fixture = await createFixture(2);
    try {
      const passengerActor = await createActor("passenger");
      expect(await canOperateTrain(passengerActor, fixture.trainId)).toBe(false);
      await expect(
        requireOperatorForRun(passengerActor, fixture.runId),
      ).rejects.toBeInstanceOf(ForbiddenError);
    } finally {
      await fixture.cleanup();
    }
  });
});
