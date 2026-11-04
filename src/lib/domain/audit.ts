import { getDb, type DbExecutor } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditInput = {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(
  input: AuditInput,
  executor?: DbExecutor,
): Promise<void> {
  const db = executor ?? getDb();
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}
