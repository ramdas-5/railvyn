import { TrainFront } from "lucide-react";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-chip border border-accent/25 bg-accent/10 text-accent">
        <TrainFront aria-hidden="true" className="h-4.5 w-4.5" />
      </span>
      <span className="leading-none">
        <span className="block text-base font-bold tracking-[0.16em] text-fg">
          RAILVYN
        </span>
        {!compact ? (
          <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-fg-muted">
            Coach &amp; seat allocation
          </span>
        ) : null}
      </span>
    </span>
  );
}
