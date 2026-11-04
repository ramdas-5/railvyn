import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  feature,
  ...props
}: React.ComponentProps<"div"> & { feature?: boolean }) {
  return <div className={cn(feature ? "rv-feature" : "rv-panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-chip bg-subtle text-ink-muted">
            {icon}
          </div>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

const badgeStyles = {
  neutral: "border-line-light bg-subtle text-ink",
  success: "border-success-ink/15 bg-success text-success-ink",
  warning: "border-warning-ink/15 bg-warning text-warning-ink",
  danger: "border-danger-ink/15 bg-danger text-danger-ink",
  accent: "border-accent-ink/20 bg-accent text-accent-ink",
  dark: "border-line bg-raised text-fg-muted",
  "dark-accent": "border-accent/30 bg-accent/15 text-accent",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: React.ReactNode;
  tone?: keyof typeof badgeStyles;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        badgeStyles[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" || tone === "accent"
              ? "bg-success-ink"
              : tone === "danger"
                ? "bg-danger-ink"
                : tone === "warning"
                  ? "bg-warning-ink"
                  : "bg-ink-muted",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

const alertStyles = {
  info: { box: "border-line-light bg-subtle text-ink", icon: Info },
  success: { box: "border-success-ink/20 bg-success text-success-ink", icon: CheckCircle2 },
  warning: { box: "border-warning-ink/25 bg-warning text-warning-ink", icon: AlertTriangle },
  danger: { box: "border-danger-ink/20 bg-danger text-danger-ink", icon: XCircle },
  dark: { box: "border-line bg-raised text-fg", icon: Info },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof alertStyles;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const config = alertStyles[tone];
  const Icon = config.icon;
  return (
    <div
      className={cn("flex gap-3 rounded-small border p-3.5 text-sm", config.box, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-small border border-dashed border-line-light bg-subtle/40 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-ink-muted">{icon}</div> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SearchEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <EmptyState title={title} description={description} icon={<Info className="h-5 w-5" />} />;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "light",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "light" | "dark";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-small border p-4",
        tone === "light"
          ? "border-line-light bg-panel text-ink"
          : "border-line bg-raised text-fg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.08em]",
            tone === "light" ? "text-ink-muted" : "text-fg-muted",
          )}
        >
          {label}
        </p>
        {icon ? (
          <span className={tone === "light" ? "text-ink-muted" : "text-fg-muted"}>{icon}</span>
        ) : null}
      </div>
      <p className="rv-mono mt-3 text-2xl font-semibold leading-none">{value}</p>
      {hint ? (
        <p
          className={cn(
            "mt-2 text-xs",
            tone === "light" ? "text-ink-muted" : "text-fg-muted",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function DemoNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted",
        className,
      )}
    >
      <span className="font-semibold uppercase tracking-[0.08em]">Demonstration</span>
      <span aria-hidden="true">·</span>
      <span>Not official IRCTC or Indian Railways inventory. Demo payments only.</span>
    </p>
  );
}
