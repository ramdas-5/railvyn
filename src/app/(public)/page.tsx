import Link from "next/link";
import {
  ArrowRight,
  Armchair,
  ChartNoAxesColumn,
  CircleDot,
  Gauge,
  ShieldCheck,
  Split,
  Waypoints,
} from "lucide-react";
import { Badge, Panel } from "@/components/ui/surfaces";
import { TRAVEL_CLASS_LABELS } from "@/lib/utils";

export const dynamic = "force-dynamic";

function ReuseDiagram() {
  return (
    <figure className="mt-8">
      <div
        className="rounded-card border border-line bg-canvas/50 p-4 sm:p-5"
        role="img"
        aria-label="Example: coach S1 seat 42 is booked from New Delhi to Kanpur Central, then the same seat is reused from Kanpur Central to Howrah on the same run."
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Journey-aware reuse · example
          </p>
          <Badge tone="dark-accent" dot>
            Same physical berth
          </Badge>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[10px] text-fg-muted">
          <span className="w-14 shrink-0 font-mono">S1 · 42</span>
          <div className="relative flex-1">
            <div className="rv-rail-line h-0.5 w-full" />
            <div className="mt-3 flex gap-1.5">
              <div className="flex-[3] rounded-[6px] border border-accent/40 bg-accent/20 px-2 py-1.5 text-accent">
                NDLS → CNB
              </div>
              <div className="flex-[4] rounded-[6px] border border-line bg-raised px-2 py-1.5 text-fg-muted">
                CNB → HWH
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[10px]">
              <span>NDLS</span>
              <span className="text-accent">CNB · seat released</span>
              <span>HWH</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 border-t border-line pt-3 text-xs text-fg-muted sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Leg 1 claim · segments 0–2
          </p>
          <p className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rail" aria-hidden="true" />
            Leg 2 claim · segments 3–6, no overlap
          </p>
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] text-fg-muted">
        A database unique index on (seat, segment) makes overlapping claims
        impossible; adjacent legs are deliberately allowed.
      </figcaption>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 78% 0%, rgba(218,242,143,0.11), transparent 40%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.04), transparent 40%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <Badge tone="dark-accent" dot>
              Railway coach &amp; dynamic seat allocation
            </Badge>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.02] sm:text-5xl lg:text-6xl">
              Every journey.
              <br />
              <span className="text-accent">Precisely placed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted">
              RAILVYN is a database-first railway reservation and operations
              demonstration. It sells a berth for the leg you travel, releases it
              when you alight, and protects every allocation with PostgreSQL
              segment claims.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/search"
                className="inline-flex h-11 items-center gap-2 rounded-chip bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-[#e7ffa8]"
              >
                Find a journey
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-chip border border-line bg-raised px-5 text-sm text-fg hover:border-rail"
              >
                See how reuse works
              </Link>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-line pt-5 text-xs">
              <div>
                <dt className="text-fg-muted">Allocation</dt>
                <dd className="mt-1 font-semibold text-fg">Segment claims</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Hold window</dt>
                <dd className="mt-1 font-semibold text-fg">5 minutes</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Waitlist</dt>
                <dd className="mt-1 font-semibold text-fg">FIFO queue</dd>
              </div>
            </dl>
          </div>
          <div>
            <ReuseDiagram />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            The model
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            A reservation system, not a dashboard mockup.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            A run with stops 0…N has segments 0…N-1. A journey from station a to b
            claims every segment in the half-open range [a,b). Overlap is rejected
            by a unique constraint; a seat can be sold again on a later leg.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Split,
              title: "Segment integrity",
              text: "Claims are inserted for every occupied segment inside one transaction, with lazy expiry of stale holds.",
            },
            {
              icon: Armchair,
              title: "Interactive coach map",
              text: "Berth labels, accessible seats, coach tabs and a keyboard-friendly list alternative for every class.",
            },
            {
              icon: Gauge,
              title: "Operations cockpit",
              text: "Coach × segment occupancy, waitlists, disruptions and audited seat reassignment for scoped operators.",
            },
            {
              icon: ChartNoAxesColumn,
              title: "Genuine analytics",
              text: "Occupancy, seat reuse, cancellations and waitlist ageing computed directly from PostgreSQL.",
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <Panel key={feature.title} className="p-5">
                <span className="grid h-10 w-10 place-items-center rounded-chip bg-subtle text-ink">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.text}</p>
              </Panel>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Panel feature className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Passenger flow
                </p>
                <h3 className="mt-1 text-2xl font-semibold">Book a leg in four precise steps.</h3>
              </div>
              <CircleDot aria-hidden="true" className="h-5 w-5 text-ink-muted" />
            </div>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["01", "Search a dated run", "Choose boarding, alighting, date, class and party size."],
                ["02", "Inspect the coach", "See which berths are free for your exact segments."],
                ["03", "Hold for five minutes", "Seats are claimed transactionally and expire automatically."],
                ["04", "Confirm with demo pay", "A RAILVYN reference is issued; no real payment is taken."],
              ].map(([step, title, text]) => (
                <li key={step} className="rounded-small border border-line-light/70 bg-white/50 p-4">
                  <span className="rv-mono text-xs font-semibold text-ink-muted">{step}</span>
                  <p className="mt-2 text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              {Object.entries(TRAVEL_CLASS_LABELS).map(([value, label]) => (
                <Badge key={value} tone="neutral">
                  {label}
                </Badge>
              ))}
              <Badge tone="accent">Accessible berths modelled</Badge>
            </div>
          </Panel>
          <Panel className="p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Truth boundary
            </p>
            <h3 className="mt-1 text-xl font-semibold">Demonstration, stated plainly.</h3>
            <ul className="mt-4 space-y-3 text-sm text-ink-muted">
              <li className="flex gap-2.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <span>No connection to IRCTC, Indian Railways or live inventory.</span>
              </li>
              <li className="flex gap-2.5">
                <Waypoints aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <span>References begin with <strong className="text-ink">RVN-</strong> and are never official PNRs.</span>
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <span>Checkout uses a demo adapter; card details are never stored.</span>
              </li>
            </ul>
            <div className="mt-6 rounded-small border border-warning-ink/20 bg-warning p-3 text-xs text-warning-ink">
              Every train, fare and seat shown here is seeded demonstration data,
              clearly labelled throughout the app.
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}
