"use client";

import { useActionState } from "react";
import { IDLE_ACTION, type ActionState } from "@/lib/action-result";
import { SubmitButton } from "@/components/ui/submit-button";

export function InlineActionForm({
  action,
  hidden,
  label,
  pendingLabel = "Working…",
  variant = "ghost-light",
  confirmText,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost-light" | "outline";
  confirmText?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE_ACTION);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton size="sm" variant={variant} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
      {state.status === "error" ? (
        <p role="alert" className="mt-1 max-w-56 text-[11px] text-danger-ink">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
