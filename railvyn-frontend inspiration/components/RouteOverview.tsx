import { MapPin, ChevronRight, Route, Clock, Layers, Users } from "lucide-react";

const rows = [
  { icon: Route, label: "Total Distance", value: "≈ 441 km" },
  { icon: Clock, label: "Travel Time", value: "≈ 9h 10m" },
  { icon: Layers, label: "Segments", value: "3" },
  { icon: Users, label: "Avg. Occupancy", value: "87.4%" },
];

export default function RouteOverview() {
  return (
    <section className="card relative flex flex-col overflow-hidden">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5"><MapPin size={18} /></div>
        <div className="flex-1">
          <h2 className="font-semibold">Route Overview</h2>
          <p className="text-xs text-muted">NDLS → ALD → LKO → CNB</p>
        </div>
        <ChevronRight size={16} className="text-muted" />
      </div>
      <ul className="divide-y divide-line text-sm">
        {rows.map(({ icon: I, label, value }) => (
          <li key={label} className="flex items-center gap-3 py-3">
            <I size={16} className="text-slate-300" /><span className="flex-1">{label}</span><span>{value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 h-32 rounded-xl bg-gradient-to-t from-brand/20 via-emerald-900/20 to-transparent">
        <div className="relative mx-auto mt-14 h-4 w-3/4 rounded-full bg-gradient-to-r from-brand/60 to-emerald-200/70" />
        <div className="mx-auto mt-1 h-px w-full bg-brand/30" />
      </div>
    </section>
  );
}
