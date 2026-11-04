import { Bell, Check, AlertTriangle } from "lucide-react";
import { alerts } from "@/lib/data";

export default function Alerts() {
  return (
    <section className="card">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><Bell size={18} /></div>
        <h2 className="font-semibold">Alerts &amp; Insights</h2>
      </div>
      <ul className="divide-y divide-line">
        {alerts.map((a) => (
          <li key={a.title} className="flex items-center gap-3 py-2.5">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${a.type === "ok" ? "bg-brand/20 text-brand" : "bg-warn/20 text-warn"}`}>
              {a.type === "ok" ? <Check size={18} /> : <AlertTriangle size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{a.title}</div>
              <div className="truncate text-xs text-muted">{a.sub}</div>
            </div>
            <span className="whitespace-nowrap text-xs text-muted">{a.time}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
