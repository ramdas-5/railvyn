import { Ticket, ArrowRight } from "lucide-react";
import { bookings } from "@/lib/data";

export default function Bookings() {
  return (
    <section className="card">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><Ticket size={18} /></div>
        <h2 className="flex-1 font-semibold">Recent Bookings / Live Allocation Activity</h2>
        <button className="flex items-center gap-1 text-sm hover:text-brand">View All Activity <ArrowRight size={14} /></button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-white/5 text-left text-xs text-slate-300">
              {["PNR", "Train", "Coach", "Seat", "From", "To", "Booking Time", "Status"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.pnr} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2.5">{b.pnr}</td><td className="px-3">{b.train}</td><td className="px-3">{b.coach}</td>
                <td className="px-3">{b.seat}</td><td className="px-3">{b.from}</td><td className="px-3">{b.to}</td>
                <td className="px-3 whitespace-nowrap">{b.time}</td>
                <td className="px-3">
                  <span className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs ${b.status === "Confirmed" ? "bg-brand/15 text-brand" : "bg-warn/15 text-warn"}`}>{b.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
