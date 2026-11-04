import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { saveSettingsAction } from "@/actions/admin";
import { getPolicies } from "@/lib/settings";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("/admin/settings");
  const policies = await getPolicies();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Booking policy"
        description="Server-side limits used by the allocation and checkout transaction. Values are clamped in code, so a bad setting can never remove the segment-claim guarantee."
      />

      <Alert tone="info" title="Changes take effect immediately">
        Hold lifetime and seat limits are read on the next allocation. Existing holds keep
        the expiry they were created with.
      </Alert>

      <Panel className="p-5">
        <PanelHeader
          title="Policy values"
          description="Defaults can also come from environment variables; values saved here take precedence."
          icon={<SlidersHorizontal className="h-4 w-4" />}
        />
        <div className="mt-4 max-w-2xl">
          <ActionForm
            action={saveSettingsAction}
            submitLabel="Save policy"
            fields={[
              {
                name: "holdTtlSeconds",
                label: "Hold lifetime (seconds)",
                type: "number",
                min: 60,
                max: 1800,
                required: true,
                defaultValue: policies.holdTtlSeconds,
                help: "Default 300. Between 60 and 1800 seconds.",
              },
              {
                name: "waitlistOfferTtlSeconds",
                label: "Waitlist offer lifetime (seconds)",
                type: "number",
                min: 120,
                max: 3600,
                required: true,
                defaultValue: policies.waitlistOfferTtlSeconds,
                help: "Default 600. Between 120 and 3600 seconds.",
              },
              {
                name: "maxSeatsPerBooking",
                label: "Maximum seats per booking",
                type: "number",
                min: 1,
                max: 12,
                required: true,
                defaultValue: policies.maxSeatsPerBooking,
                help: "Applies to new hold requests.",
              },
              {
                name: "allowWaitlist",
                label: "Allow passengers to join waitlists",
                type: "checkbox",
                defaultValue: policies.allowWaitlist,
                colSpan: 2,
              },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}
