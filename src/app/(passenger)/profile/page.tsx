import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/permissions";
import { signOutAction } from "@/actions/auth";
import { Badge, DemoNotice, Panel, PanelHeader } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/layout/page-heading";
import {
  PasswordForm,
  ProfileIdentity,
  ProfileNameForm,
} from "@/components/passenger/profile-forms";

export const metadata: Metadata = { title: "Profile & security" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Account"
        title="Profile & security"
        description="Update your display name, change your password and review the roles the server has granted you."
        actions={
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div className="space-y-4">
          <Panel className="p-5 sm:p-6">
            <ProfileIdentity name={user.name} email={user.email} roles={user.roles} />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <Badge key={role} tone={role === "passenger" ? "neutral" : "accent"} className="capitalize">
                  {role}
                </Badge>
              ))}
              <Badge tone="success" dot>
                Email verified
              </Badge>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              Roles are read from the database on every request. Hiding a link in the
              browser is never used as authorization; operator and admin actions
              re-check roles and train scopes on the server.
            </p>
          </Panel>

          <Panel className="p-5">
            <PanelHeader
              title="Account safety"
              description="Demo environment notes."
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>• Sessions are HTTP-only cookies managed by Better Auth.</li>
              <li>• Passwords are hashed; RAILVYN never stores card data.</li>
              <li>• Password reset email is not configured; admins reset passwords.</li>
              <li>• Seeded demo credentials are documented and should be replaced.</li>
            </ul>
            <DemoNotice className="mt-3" />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5 sm:p-6">
            <PanelHeader title="Display name" description="Shown on your dashboard and internal ticket." />
            <div className="mt-4">
              <ProfileNameForm name={user.name} />
            </div>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <PanelHeader title="Change password" description="Enter your current password to set a new one." />
            <div className="mt-4">
              <PasswordForm />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
