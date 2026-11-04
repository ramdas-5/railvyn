import type { Metadata } from "next";
import { Armchair } from "lucide-react";
import { getAdminCoachTemplates } from "@/lib/queries/admin";
import { createCoachTemplateAction } from "@/actions/admin";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Coach templates" };
export const dynamic = "force-dynamic";

export default async function AdminCoachesPage() {
  await requireAdminPage("/admin/coaches");
  const templates = await getAdminCoachTemplates();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Coach templates"
        description="Templates define seat numbers, berth types, rows and accessibility. Adding a template to a run generates physical run seats; editing a template never rewrites a sold run."
      />

      <Panel className="p-5">
        <PanelHeader
          title="Create a coach template"
          description="Berth types follow the selected class. The first seats are marked accessible where the layout allows."
          icon={<Armchair className="h-4 w-4" />}
        />
        <div className="mt-4">
          <ActionForm
            action={createCoachTemplateAction}
            submitLabel="Create template"
            fields={[
              { name: "code", label: "Template code", placeholder: "SL-72", required: true },
              { name: "name", label: "Layout name", placeholder: "Sleeper 72 berth", required: true },
              {
                name: "travelClass",
                label: "Travel class",
                type: "select",
                required: true,
                options: Object.entries(TRAVEL_CLASS_LABELS).map(([value, label]) => ({
                  value,
                  label,
                })),
              },
              {
                name: "layoutStyle",
                label: "Layout style",
                placeholder: "3-tier bays with side berths",
                required: true,
              },
              { name: "bays", label: "Number of bays", type: "number", min: 1, max: 30, required: true },
              {
                name: "berthsPerBay",
                label: "Berths per bay",
                type: "number",
                min: 2,
                max: 10,
                required: true,
              },
            ]}
          />
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Template registry"
          description="Usage counts show how many run coaches were instantiated from each template."
          icon={<Armchair className="h-4 w-4" />}
        />
        <div className="mt-4">
          {templates.length === 0 ? (
            <EmptyState
              title="No coach templates yet"
              description="Create at least one template per sold class before generating runs."
              icon={<Armchair className="h-5 w-5" />}
            />
          ) : (
            <div className="rv-scroll">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <caption className="sr-only">Coach templates</caption>
                <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2">Code</th>
                    <th scope="col" className="py-2">Template</th>
                    <th scope="col" className="py-2">Class</th>
                    <th scope="col" className="py-2">Layout</th>
                    <th scope="col" className="py-2">Seats</th>
                    <th scope="col" className="py-2">Used by</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-t border-line-light/70">
                      <td className="rv-mono py-2.5 font-semibold">{template.code}</td>
                      <td className="py-2.5">
                        {template.name}
                        <span className="block text-[10px] text-ink-muted">
                          {template.berthTypes || "No berth types"}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs">
                        {TRAVEL_CLASS_LABELS[template.travelClass]}
                      </td>
                      <td className="py-2.5 text-xs text-ink-muted">{template.layoutStyle}</td>
                      <td className="rv-mono py-2.5">{template.totalSeats}</td>
                      <td className="rv-mono py-2.5 text-xs">
                        {template.runUsages} run coach{template.runUsages === 1 ? "" : "es"}
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
