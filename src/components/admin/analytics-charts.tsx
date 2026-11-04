"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = {
  day: string;
  bookings: number;
  cancellations: number;
};

export function BookingsTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="rounded-small border border-dashed border-line-light p-6 text-center text-sm text-ink-muted">
        No bookings were created in the last 30 days, so there is no trend to plot.
      </p>
    );
  }

  return (
    <div className="h-64 w-full" role="img" aria-label="Bookings and cancellations per day over the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#cfd6cd" strokeDasharray="3 4" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#48534b" }}
            tickLine={false}
            axisLine={{ stroke: "#cfd6cd" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "#48534b" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #cfd6cd",
              background: "#f7f8f3",
              color: "#161a17",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="bookings"
            name="Bookings"
            stroke="#263416"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="cancellations"
            name="Cancellations"
            stroke="#5f1b0b"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
