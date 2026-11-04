"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  forgotPasswordAction,
  signInAction,
  signUpAction,
} from "@/actions/auth";
import { IDLE_ACTION, fieldMessage } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/surfaces";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert tone="danger" className="mb-4">
      <span className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4" />
        {message}
      </span>
    </Alert>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError message={state.status === "error" ? state.message : undefined} />
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldMessage(state, "email"))}
          aria-describedby={fieldMessage(state, "email") ? "email-error" : undefined}
        />
        {fieldMessage(state, "email") ? (
          <p id="email-error" className="mt-1.5 text-xs text-danger-ink">
            {fieldMessage(state, "email")}
          </p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldMessage(state, "password"))}
        />
        {fieldMessage(state, "password") ? (
          <p className="mt-1.5 text-xs text-danger-ink">{fieldMessage(state, "password")}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Link href="/forgot-password" className="text-xs text-ink-muted underline underline-offset-2">
          Forgot password?
        </Link>
        <Link href="/signup" className="text-xs font-semibold text-ink underline underline-offset-2">
          Create an account
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, IDLE_ACTION);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={state.status === "error" ? state.message : undefined} />
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" autoComplete="name" required />
        {fieldMessage(state, "name") ? (
          <p className="mt-1.5 text-xs text-danger-ink">{fieldMessage(state, "name")}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="email">Email address</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {fieldMessage(state, "email") ? (
          <p className="mt-1.5 text-xs text-danger-ink">{fieldMessage(state, "email")}</p>
        ) : null}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          At least 8 characters. Stored as a salted hash by Better Auth.
        </p>
        {fieldMessage(state, "password") ? (
          <p className="mt-1.5 text-xs text-danger-ink">{fieldMessage(state, "password")}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Creating account…" : "Create passenger account"}
      </Button>
      <p className="text-center text-xs text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    IDLE_ACTION,
  );
  return (
    <form action={formAction} className="space-y-4">
      {state.status === "success" ? (
        <Alert tone="warning" title="Email delivery is not configured">
          {state.message}
        </Alert>
      ) : null}
      <FormError message={state.status === "error" ? state.message : undefined} />
      <div>
        <Label htmlFor="email">Account email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton className="w-full" pendingLabel="Checking…">
        Continue
      </SubmitButton>
      <p className="text-center text-xs text-ink-muted">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
      <p className="text-center text-[11px] text-ink-muted">
        {pending ? "" : "This demonstration does not send email."}
      </p>
    </form>
  );
}
