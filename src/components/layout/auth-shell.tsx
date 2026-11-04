import Link from "next/link";
import { ArrowLeft, ShieldCheck, Ticket, TrainFront } from "lucide-react";
import { Wordmark } from "./wordmark";
import { Badge } from "@/components/ui/surfaces";

export function AuthShell({
  children,
  title,
  description,
  footer,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  footer?: React.ReactNode;
}) {
  return (
    <main id="main-content" className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-raised p-10 lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 10%, rgba(218,242,143,0.14), transparent 42%), repeating-linear-gradient(90deg, transparent 0 79px, rgba(255,255,255,0.035) 79px 80px)",
          }}
        />
        <div className="relative">
          <Link href="/" aria-label="RAILVYN home">
            <Wordmark />
          </Link>
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Every journey. Precisely placed.
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-[1.05]">
            A seat is not a seat for the whole line.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">
            RAILVYN releases a berth the moment a passenger alights, then sells it
            again for the next leg — with database-enforced claims so overlapping
            journeys can never collide.
          </p>
          <div className="mt-8 space-y-4">
            {[
              {
                icon: TrainFront,
                title: "Segment-aware inventory",
                text: "One physical seat, many legal legs.",
              },
              {
                icon: Ticket,
                title: "Internal booking references",
                text: "Clearly not an official PNR.",
              },
              {
                icon: ShieldCheck,
                title: "Server-enforced roles",
                text: "Passenger, operator scopes, admin audit trail.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-chip border border-line bg-canvas/50 text-accent">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-fg-muted">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Badge tone="dark">Independent demo</Badge>
          <Badge tone="dark">Demo payments</Badge>
          <Badge tone="dark">Neon PostgreSQL</Badge>
        </div>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to RAILVYN
          </Link>
          <div className="rounded-card border border-line-light bg-panel p-6 text-ink shadow-xl sm:p-8">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-5 border-t border-line-light pt-4">{footer}</div> : null}
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-fg-muted">
            Demonstration system, not IRCTC or Indian Railways. No real tickets
            or payments are issued.
          </p>
        </div>
      </section>
    </main>
  );
}
