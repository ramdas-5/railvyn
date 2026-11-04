"use client";
import { useState } from "react";
import { Armchair, ChevronDown, X } from "lucide-react";
import { seatRows } from "@/lib/data";

const legend = [
  { k: "a", label: "Available" },
  { k: "o", label: "Occupied" },
  { k: "r", label: "Reserved (later segment)" },
  { k: "b", label: "Blocked" },
  { k: "w", label: "Waitlisted" },
];

function Seat({ s, title }: { s: string; title: string }) {
  const base = "grid h-5 w-5 place-items-center rounded-[5px] sm:h-6 sm:w-6";
  const cls =
    s === "a" ? "bg-brand/80 hover:bg-brand"
    : s === "o" ? "bg-slate-600/60"
    : s === "r" ? "hatch"
    : s === "b" ? "bg-slate-700/50 text-danger"
    : "border border-dashed border-brand/80";
  return <div title={title} className={`${base} ${cls}`}>{s === "b" && <X size={14} strokeWidth={3} />}</div>;
}

export default function SeatMap() {
  const rows = Object.entries(seatRows);
  const counts = legend.map(({ k }) => rows.reduce((n, [, r]) => n + [...r].filter((c) => c === k).length, 0));
  const [coach, setCoach] = useState("S3");
  return (
    <section className="card min-w-0">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><Armchair size={18} /></div>
        <div className="flex-1">
          <h2 className="font-semibold">Dynamic Seat Allocation</h2>
          <p className="text-xs text-muted">Coach S3 • 3A (AC) • 72 Seats</p>
        </div>
        <label className="relative">
          <select value={coach} onChange={(e) => setCoach(e.target.value)}
            className="appearance-none rounded-lg border border-line bg-panel py-1.5 pl-2.5 pr-6 text-xs outline-none">
            {["S1", "S2", "S3", "S4"].map((c) => <option key={c}>Coach: {c}</option>)}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-2.5" />
        </label>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="overflow-x-auto">
          <div className="grid w-max grid-cols-[16px_repeat(12,auto)] items-center gap-x-1.5 gap-y-1.5 text-xs text-muted sm:gap-x-2">
            <span />
            {Array.from({ length: 12 }, (_, i) => <span key={i} className="text-center">{i + 1}</span>)}
            {rows.map(([row, seats], idx) => (
              <div key={row} className={`contents`}>
                <span className={idx === 3 ? "mt-3" : ""}>{row}</span>
                {[...seats].map((s, i) => (
                  <div key={i} className={idx === 3 ? "mt-3" : ""}><Seat s={s} title={`${row}${i + 1}`} /></div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <ul className="flex-1 space-y-2 rounded-xl border border-line bg-black/20 p-3 text-xs">
          {legend.map((l, i) => (
            <li key={l.k} className="flex items-center gap-2">
              <Seat s={l.k} title={l.label} />
              <span className="flex-1">{l.label}</span>
              <span className="text-muted">({counts[i]})</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
