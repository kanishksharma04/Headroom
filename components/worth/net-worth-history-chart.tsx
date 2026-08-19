"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDate } from "@/lib/format-date";
import { formatMoney, formatMoneyShorthand } from "@/lib/format-money";

export function NetWorthHistoryChart({ data }: { data: { date: number; netWorth: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => formatLongDate(new Date(v)).split(" ").slice(0, 2).join(" ")}
            className="text-xs"
          />
          <YAxis tickFormatter={(v: number) => formatMoneyShorthand(v)} width={64} className="text-xs" />
          <Tooltip
            formatter={(value) => (typeof value === "number" ? formatMoney(value, { decimals: 0 }) : String(value))}
            labelFormatter={(label) => (typeof label === "number" ? formatLongDate(new Date(label)) : String(label))}
          />
          <Line
            type="monotone"
            dataKey="netWorth"
            name="Net worth"
            stroke="var(--number)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
