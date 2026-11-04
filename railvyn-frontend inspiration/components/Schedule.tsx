import { TrainFront, ChevronRight } from "lucide-react";
import { stations } from "@/lib/data";

export default function Schedule() {
  return (
    <section className="card">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><TrainFront size={18} /></div>
        <div className="flex-1">
          <h2 className="font-semibold">Train Schedule (12451)</h2>
          <p className="text-xs text-muted">12451 • NDLS – CNB Express</p>
        </div>
        <ChevronRight size={16} className="text-muted" />
      </div>
      <ol className="relative space-y-4">
        <span className="absolute bottom-3 left-[5px] top-3 w-px bg-slate-500" />
        {stations.map((s, i) => (
          <li key={s.code} className="relative flex items-center gap-3 pl-5 text-sm">
            <span className={`absolute left-0 h-3 w-3 rounded-full border-2 ${i === 0 ? "border-brand bg-brand" : "border-slate-300 bg-bg"}`} />
            <b className="w-11">{s.code}</b>
            <span className="flex-1 truncate text-slate-300">{s.name}</span>
            <span className={`rounded-md px-2 py-1 text-xs ${i === 0 ? "bg-brand/20 text-brand" : "bg-white/5"}`}>{s.time}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
