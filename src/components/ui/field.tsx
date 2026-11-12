import * as React from "react";
import { ChevronDown } from "lucide-react";
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
    <div className="relative">
      <select
        className={cn(
          baseField,
          "peer appearance-none bg-none pr-9 text-ellipsis",
          variant === "light"
            ? cn(
                lightField,
                "[color-scheme:light] [&>option]:bg-panel [&>option]:text-ink",
              )
            : cn(
                darkField,
                "[color-scheme:dark] [&>option]:bg-raised [&>option]:text-fg",
              ),
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 peer-disabled:opacity-60",
          variant === "light" ? "text-ink-muted" : "text-fg-muted",
        )}
      />
    </div>
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
