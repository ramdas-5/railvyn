"use client";

import { useActionState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import {
  changePasswordAction,
  updateProfileAction,
} from "@/actions/auth";
import { IDLE_ACTION, fieldMessage } from "@/lib/action-result";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/surfaces";

export function ProfileNameForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(updateProfileAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      <div>
        <Label htmlFor="profile-name">Display name</Label>
        <Input id="profile-name" name="name" defaultValue={name} required />
        {fieldMessage(state, "name") ? (
          <p className="mt-1.5 text-xs text-danger-ink">{fieldMessage(state, "name")}</p>
        ) : null}
      </div>
      <SubmitButton size="sm" pendingLabel="Saving…">
        <Save aria-hidden="true" className="h-4 w-4" />
        Save profile
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-3">
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </div>
      {fieldMessage(state, "confirmPassword") ? (
        <p className="text-xs text-danger-ink">{fieldMessage(state, "confirmPassword")}</p>
      ) : null}
      <SubmitButton size="sm" variant="secondary" pendingLabel="Updating…">
        <KeyRound aria-hidden="true" className="h-4 w-4" />
        Change password
      </SubmitButton>
      <p className="text-[11px] text-ink-muted">
        Passwords are hashed by Better Auth. Other sessions are not revoked by this
        demo change.
      </p>
    </form>
  );
}

export function ProfileIdentity({
  name,
  email,
  roles,
}: {
  name: string;
  email: string;
  roles: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-chip bg-accent text-accent-ink">
        <UserRound aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-ink-muted">{email}</p>
        <p className="mt-1 text-xs text-ink-muted">
          Server roles: {roles.join(", ")}
        </p>
      </div>
    </div>
  );
}
