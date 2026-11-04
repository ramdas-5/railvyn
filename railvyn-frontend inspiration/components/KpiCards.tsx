import { TrainFront, Ticket, Users, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { kpis } from "@/lib/data";

const icons: Record<string, React.ReactNode> = {
  train: <TrainFront />, ticket: <Ticket />, users: <Users />, clock: <Clock />,
};

function Ring({ pct }: { pct: number }) {
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#3fd58a ${pct * 3.6}deg, #1d2823 0)` }}>
      <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-panel text-[11px] font-semibold">{pct}%</div>
    </div>
  );
}

export default function KpiCards() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {kpis.map((k) => (
        <div key={k.label} className="card flex items-center gap-4">
          {k.icon === "ring" ? <Ring pct={87.4} /> : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-white/5 text-slate-200">{icons[k.icon]}</div>
          )}
          <div>
            <div className="text-sm text-slate-300">{k.label}</div>
            <div className="text-3xl font-bold leading-tight">{k.value}</div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <span className={`flex items-center font-semibold ${k.up ? "text-brand" : "text-danger"}`}>
                {k.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{k.delta}
              </span>
              vs. previous day
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
