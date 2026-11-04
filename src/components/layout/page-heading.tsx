import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  tone = "dark",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              tone === "dark" ? "text-fg-muted" : "text-ink-muted",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "mt-1.5 text-2xl font-semibold sm:text-3xl",
            tone === "dark" ? "text-fg" : "text-ink",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-2 max-w-2xl text-sm leading-relaxed",
              tone === "dark" ? "text-fg-muted" : "text-ink-muted",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function AccessDenied({
  title = "You do not have access to this area",
  description = "RAILVYN checks your role on the server for every page and action. Ask an administrator if you believe you should have access.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        Access denied
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-fg-muted">{description}</p>
    </div>
  );
}
