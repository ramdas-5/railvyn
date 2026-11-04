import type { Metadata } from "next";
import { ScrollText, Search } from "lucide-react";
import { getAdminAudit } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/datetime";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  await requireAdminPage("/admin/audit");
  const entries = await getAdminAudit(q);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Audit trail"
        description="Inventory transitions, role changes, pricing, disruptions and settings writes. Entries record the actor, role, entity and structured metadata."
      />

      <Panel className="p-5">
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-64 flex-1">
            <label htmlFor="audit-search" className="rv-label">
              Search the trail
            </label>
            <Input
              id="audit-search"
              name="q"
              defaultValue={q}
              placeholder="action, entity, actor email or entity id"
              type="search"
            />
          </div>
          <Button type="submit" size="md">
            <Search aria-hidden="true" className="h-4 w-4" />
            Search
          </Button>
          {q ? (
            <Button asChild variant="outline" size="md">
              <a href="/admin/audit">Clear</a>
            </Button>
          ) : null}
        </form>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title={q ? `Results for “${q}”` : "Most recent entries"}
          description={`${entries.length} entr${entries.length === 1 ? "y" : "ies"} shown, newest first.`}
          icon={<ScrollText className="h-4 w-4" />}
        />
        <div className="mt-4">
          {entries.length === 0 ? (
            <EmptyState
              title="No audit entries match"
              description="Try a shorter action fragment, an actor email or an entity type."
              icon={<ScrollText className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[58rem] text-left text-sm">
                <caption className="sr-only">Audit log entries</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">When</th>
                    <th scope="col" className="py-2">Actor</th>
                    <th scope="col" className="py-2">Action</th>
                    <th scope="col" className="py-2">Entity</th>
                    <th scope="col" className="py-2">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-line-light/70 align-top">
                      <td className="py-2.5 text-xs">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="py-2.5 text-xs">
                        <span className="font-semibold">{entry.actorName ?? "System"}</span>
                        <span className="block text-[10px] text-ink-muted">
                          {entry.actorEmail ?? "—"} · {entry.actorRole ?? "unknown role"}
                        </span>
                      </td>
                      <td className="rv-mono py-2.5 text-[11px] font-semibold">{entry.action}</td>
                      <td className="py-2.5 text-xs">
                        {entry.entityType}
                        {entry.entityId ? (
                          <span className="rv-mono block max-w-48 truncate text-[10px] text-ink-muted">
                            {entry.entityId}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-[11px] text-ink-muted">
                        {entry.metadata ? (
                          <code className="block max-w-72 whitespace-pre-wrap break-words">
                            {JSON.stringify(entry.metadata)}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
