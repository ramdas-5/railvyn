import { Route, Armchair, Info } from "lucide-react";

const stops = [
  { c: "NDLS", km: "0 km" }, { c: "ALD", km: "≈ 118 km" }, { c: "LKO", km: "≈ 312 km" }, { c: "CNB", km: "≈ 441 km" },
];

export default function SegmentReuse() {
  return (
    <section className="card min-w-0">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><Route size={18} /></div>
        <div>
          <h2 className="font-semibold">Train Route &amp; Segment-Aware Seat Reuse</h2>
          <p className="text-xs text-muted">Dynamic allocation with seat reuse across non-overlapping segments</p>
        </div>
      </div>
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="relative flex flex-1 justify-between px-2 py-4">
          <span className="absolute left-6 right-6 top-[26px] h-px bg-slate-500" />
          {stops.map((s, i) => (
            <div key={s.c} className="relative z-10 flex flex-col items-center gap-2 text-center">
              <span className={`h-3.5 w-3.5 rounded-full border-2 ${i === 0 ? "border-brand bg-brand/70" : "border-slate-200 bg-bg"}`} />
              <b className="text-sm">{s.c}</b>
              <span className="text-[11px] text-muted">({s.km})</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-black/20 p-3 md:w-72">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            Seat Reuse Example <span className="rounded-md border border-line px-2 py-0.5 text-xs font-normal">S3 – Seat 42</span>
          </div>
          {[["NDLS → ALD", "Occupied", "bg-white/10"], ["ALD → CNB", "Available", "bg-brand/20 text-brand"]].map(([r, s, c]) => (
            <div key={r} className="mb-1.5 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-2 text-xs">
              <Armchair size={14} /> <span className="flex-1">{r}</span>
              <span className={`rounded-md px-2 py-0.5 ${c}`}>{s}</span>
            </div>
          ))}
          <p className="mt-2 flex gap-1.5 text-[11px] text-muted"><Info size={12} className="mt-0.5 shrink-0" />Same seat reused for a later segment after the passenger deboards at ALD.</p>
        </div>
      </div>
    </section>
  );
}
