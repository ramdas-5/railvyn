import * as React from "react";
import { cn } from "@/lib/utils";

const baseField =
  "w-full rounded-chip border px-3 py-2.5 text-sm transition-colors placeholder:text-ink-muted/60 disabled:cursor-not-allowed disabled:opacity-60";

const lightField =
  "border-line-light bg-white/75 text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent-ink/15 aria-[invalid=true]:border-danger-ink";

const darkField =
  "border-line bg-canvas/60 text-fg placeholder:text-fg-muted/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export type FieldVariant = "light" | "dark";

export function Input({
  className,
  variant = "light",
  ...props
}: React.ComponentProps<"input"> & { variant?: FieldVariant }) {
  return (
    <input
      className={cn(baseField, variant === "light" ? lightField : darkField, className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  variant = "light",
  ...props
}: React.ComponentProps<"textarea"> & { variant?: FieldVariant }) {
  return (
    <textarea
      className={cn(
        baseField,
        "min-h-24 resize-y",
        variant === "light" ? lightField : darkField,
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  variant = "light",
  ...props
}: React.ComponentProps<"select"> & { variant?: FieldVariant }) {
  return (
    <select
      className={cn(
        baseField,
        "appearance-none bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9",
        variant === "light" ? lightField : darkField,
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2348534B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    />
  );
}

export function Label({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return <label className={cn("rv-label", className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-danger-ink" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-ink-muted">{children}</p>;
}
