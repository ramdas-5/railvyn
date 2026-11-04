"use client";
import { BarChart3, ChevronDown } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { trend } from "@/lib/data";

export default function TrendChart() {
  return (
    <section className="card min-w-0">
      <div className="mb-3 flex items-start gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5"><BarChart3 size={18} /></div>
        <div className="flex-1">
          <h2 className="font-semibold">Booking &amp; Occupancy Trend</h2>
          <p className="text-xs text-muted">Last 7 days • Bookings (bars) &amp; Occupancy Rate (line)</p>
        </div>
        <button className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs">Last 7 Days <ChevronDown size={12} /></button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3fd58a" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#3fd58a" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1d2823" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: "#8b9791", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" domain={[0, 70000]} tickFormatter={(v) => `${v / 1000}K`} tick={{ fill: "#8b9791", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="r" orientation="right" domain={[50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#8b9791", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0e1411", border: "1px solid #1d2823", borderRadius: 8 }} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="bookings" name="Confirmed Bookings" fill="url(#bar)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="r" dataKey="occ" name="Occupancy Rate" stroke="#4ade80" strokeWidth={2} dot={{ r: 3, fill: "#4ade80" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
