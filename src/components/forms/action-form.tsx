"use client";

import * as React from "react";
import { useActionState } from "react";
import { IDLE_ACTION, fieldMessage, type ActionState } from "@/lib/action-result";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/surfaces";
import { cn } from "@/lib/utils";

export type ActionFormOption = { value: string; label: string };

export type ActionFormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "select"
    | "textarea"
    | "checkbox"
    | "checkboxes"
    | "hidden";
  options?: ActionFormOption[];
  defaultValue?: string | number | boolean;
  defaultValues?: string[];
  placeholder?: string;
  help?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  colSpan?: 1 | 2;
  disabled?: boolean;
};

export function ActionForm({
  action,
  fields,
  hidden,
  submitLabel,
  submitVariant = "primary",
  columns = 2,
  compact = false,
  intro,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  fields: ActionFormField[];
  hidden?: Record<string, string>;
  submitLabel: string;
  submitVariant?: "primary" | "secondary" | "danger" | "outline";
  columns?: 1 | 2;
  compact?: boolean;
  intro?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, IDLE_ACTION);
  const idBase = React.useId();

  return (
    <form action={formAction} className={cn(compact ? "space-y-2" : "space-y-4")}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {intro}
      {state.status === "error" ? (
        <Alert tone="danger" title="Not saved">
          {state.message}
        </Alert>
      ) : null}
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      <div
        className={cn(
          "grid gap-3",
          columns === 2 && !compact && "sm:grid-cols-2",
          compact && "sm:grid-cols-[1fr_auto] sm:items-end",
        )}
      >
        {fields.map((field, index) => {
          if (field.type === "hidden") {
            return (
              <input
                key={field.name}
                type="hidden"
                name={field.name}
                value={String(field.defaultValue ?? "")}
              />
            );
          }
          const id = `${idBase}-${index}-${field.name}`;
          const message = fieldMessage(state, field.name);
          const wrapperSpan =
            field.colSpan === 2 && !compact ? "sm:col-span-2" : undefined;

          if (field.type === "checkbox") {
            return (
              <div key={field.name} className={wrapperSpan}>
                <label className="flex min-h-11 items-center gap-2.5 rounded-chip border border-line-light bg-white/60 px-3 py-2 text-sm">
                  <input
                    id={id}
                    type="checkbox"
                    name={field.name}
                    defaultChecked={field.defaultValue === true}
                    className="h-4 w-4 accent-[#263416]"
                  />
                  {field.label}
                </label>
                {message ? <p className="mt-1 text-xs text-danger-ink">{message}</p> : null}
              </div>
            );
          }

          if (field.type === "checkboxes") {
            return (
              <fieldset key={field.name} className={cn("min-w-0", wrapperSpan)}>
                <legend className="rv-label">{field.label}</legend>
                <div className="rv-scroll mt-1 max-h-44 rounded-chip border border-line-light bg-white/50 p-2">
                  {field.options?.length ? (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {field.options.map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-xs hover:bg-subtle"
                        >
                          <input
                            type="checkbox"
                            name={field.name}
                            value={option.value}
                            defaultChecked={field.defaultValues?.includes(option.value)}
                            className="h-3.5 w-3.5 accent-[#263416]"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="p-2 text-xs text-ink-muted">
                      No eligible seats are currently free.
                    </p>
                  )}
                </div>
                {field.help ? <p className="mt-1 text-xs text-ink-muted">{field.help}</p> : null}
                {message ? <p className="mt-1 text-xs text-danger-ink">{message}</p> : null}
              </fieldset>
            );
          }

          return (
            <div key={field.name} className={wrapperSpan}>
              <Label htmlFor={id}>{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  id={id}
                  name={field.name}
                  defaultValue={
                    field.defaultValue === undefined ? "" : String(field.defaultValue)
                  }
                  required={field.required}
                  disabled={field.disabled}
                  aria-invalid={Boolean(message)}
                >
                  {field.defaultValue === undefined ? (
                    <option value="">Choose…</option>
                  ) : null}
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  id={id}
                  name={field.name}
                  defaultValue={String(field.defaultValue ?? "")}
                  placeholder={field.placeholder}
                  required={field.required}
                  disabled={field.disabled}
                  aria-invalid={Boolean(message)}
                />
              ) : (
                <Input
                  id={id}
                  name={field.name}
                  type={field.type ?? "text"}
                  defaultValue={String(field.defaultValue ?? "")}
                  placeholder={field.placeholder}
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  disabled={field.disabled}
                  aria-invalid={Boolean(message)}
                />
              )}
              {field.help ? <p className="mt-1 text-xs text-ink-muted">{field.help}</p> : null}
              {message ? <p className="mt-1 text-xs text-danger-ink">{message}</p> : null}
            </div>
          );
        })}
      </div>
      <SubmitButton
        size="sm"
        variant={submitVariant}
        pendingLabel="Saving…"
        className={compact ? undefined : undefined}
      >
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
