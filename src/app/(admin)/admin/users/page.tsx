import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Users } from "lucide-react";
import { getAdminTrains, getAdminUsers } from "@/lib/queries/admin";
import {
  assignRoleAction,
  operatorScopeAction,
  resetUserPasswordAction,
} from "@/actions/admin";
import { formatDate } from "@/lib/datetime";
import { PageHeading } from "@/components/layout/page-heading";
import { Badge, Panel, PanelHeader } from "@/components/ui/surfaces";
import { ActionForm } from "@/components/forms/action-form";
import { InlineActionForm } from "@/components/forms/inline-action-form";
import { requireAdminPage } from "@/lib/page-auth";

export const metadata: Metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdminPage("/admin/users");
  const [users, trains] = await Promise.all([getAdminUsers(), getAdminTrains()]);
  const operators = users.filter((user) => user.roles.includes("operator"));

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Users, roles and operator scope."
        description="Every signed-in account is a passenger. Operator and admin capabilities are granted explicitly, and operator reads are limited to assigned trains on the server."
      />

      <Panel className="p-5">
        <PanelHeader
          title="Accounts"
          description={`${users.length} registered account${users.length === 1 ? "" : "s"}. The final administrator role cannot be removed.`}
          icon={<Users className="h-4 w-4" />}
        />
        <div className="mt-4 rv-scroll">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <caption className="sr-only">Registered accounts with roles and scopes</caption>
            <thead className="text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th scope="col" className="py-2">Account</th>
                <th scope="col" className="py-2">Joined</th>
                <th scope="col" className="py-2">Bookings</th>
                <th scope="col" className="py-2">Roles</th>
                <th scope="col" className="py-2">Operator scopes</th>
                <th scope="col" className="py-2 text-right">Role actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id} className="border-t border-line-light/70 align-top">
                  <td className="py-3">
                    <span className="font-semibold">{account.name}</span>
                    <span className="block text-[11px] text-ink-muted">{account.email}</span>
                  </td>
                  <td className="py-3 text-xs">{formatDate(account.createdAt)}</td>
                  <td className="rv-mono py-3 text-xs">{account.confirmedBookings}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="neutral">passenger</Badge>
                      {account.roles.map((role) => (
                        <Badge key={role} tone={role === "admin" ? "accent" : "success"}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 text-xs">
                    {account.scopes.length === 0 ? (
                      <span className="text-ink-muted">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {account.scopes.map((scope) => (
                          <Badge key={scope.trainId} tone="neutral">
                            {scope.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {account.roles.includes("operator") ? (
                        <InlineActionForm
                          action={assignRoleAction}
                          hidden={{ userId: account.id, role: "operator", action: "revoke" }}
                          label="Revoke operator"
                          confirmText={`Revoke the operator role from ${account.email}?`}
                          variant="ghost-light"
                        />
                      ) : (
                        <InlineActionForm
                          action={assignRoleAction}
                          hidden={{ userId: account.id, role: "operator", action: "grant" }}
                          label="Grant operator"
                          variant="ghost-light"
                        />
                      )}
                      {account.roles.includes("admin") ? (
                        <InlineActionForm
                          action={assignRoleAction}
                          hidden={{ userId: account.id, role: "admin", action: "revoke" }}
                          label="Revoke admin"
                          confirmText={`Revoke the admin role from ${account.email}?`}
                          variant="ghost-light"
                        />
                      ) : (
                        <InlineActionForm
                          action={assignRoleAction}
                          hidden={{ userId: account.id, role: "admin", action: "grant" }}
                          label="Grant admin"
                          variant="ghost-light"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader
            title="Assign an operator scope"
            description="Operators can only read and act on trains explicitly assigned here. Admins bypass scopes; the constraint is still enforced server-side."
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={operatorScopeAction}
              submitLabel="Grant train scope"
              fields={[
                {
                  name: "userId",
                  label: "Operator",
                  type: "select",
                  required: true,
                  options: operators.map((account) => ({
                    value: account.id,
                    label: `${account.name} — ${account.email}`,
                  })),
                },
                {
                  name: "trainId",
                  label: "Train",
                  type: "select",
                  required: true,
                  options: trains.map((train) => ({
                    value: train.id,
                    label: `${train.code} — ${train.name}`,
                  })),
                },
                { name: "action", label: "Action", type: "hidden", defaultValue: "grant" },
              ]}
            />
            {operators.length === 0 ? (
              <p className="mt-3 text-xs text-ink-muted">
                Grant the operator role to an account first.
              </p>
            ) : null}
            {operators.some((account) => account.scopes.length > 0) ? (
              <div className="mt-4 border-t border-line-light/70 pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Remove a scope
                </p>
                <div className="mt-2 space-y-2">
                  {operators.flatMap((account) =>
                    account.scopes.map((scope) => (
                      <div
                        key={`${account.id}-${scope.trainId}`}
                        className="flex items-center justify-between gap-2 rounded-chip border border-line-light px-3 py-2 text-xs"
                      >
                        <span>
                          {account.email} · <span className="rv-mono">{scope.code}</span>
                        </span>
                        <InlineActionForm
                          action={operatorScopeAction}
                          hidden={{
                            userId: account.id,
                            trainId: scope.trainId,
                            action: "revoke",
                          }}
                          label="Remove"
                          variant="ghost-light"
                        />
                      </div>
                    )),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Reset a password"
            description="No reset email is sent in this demonstration. This action replaces the credential hash and signs out existing sessions."
            icon={<KeyRound className="h-4 w-4" />}
          />
          <div className="mt-4">
            <ActionForm
              action={resetUserPasswordAction}
              submitLabel="Reset password"
              fields={[
                {
                  name: "userId",
                  label: "Account",
                  type: "select",
                  required: true,
                  colSpan: 2,
                  options: users.map((account) => ({
                    value: account.id,
                    label: `${account.email} — ${account.name}`,
                  })),
                },
                {
                  name: "newPassword",
                  label: "New password",
                  type: "password",
                  required: true,
                  colSpan: 2,
                  help: "At least 8 characters. The account is signed out everywhere.",
                },
              ]}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
