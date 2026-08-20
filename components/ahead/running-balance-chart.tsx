"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatLongDate } from "@/lib/format-date";
import { formatMoney, formatMoneyShorthand } from "@/lib/format-money";

export type RunningBalancePoint = { date: number; balance: number };

export function RunningBalanceChart({
  data,
  lowestPoint,
  goesNegative,
}: {
  data: RunningBalancePoint[];
  lowestPoint: RunningBalancePoint;
  goesNegative: boolean;
}) {
  const lineColor = goesNegative ? "var(--destructive)" : "var(--number)";

  return (
    <div className="h-48 w-full">
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
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
          <Tooltip
            formatter={(value) =>
              typeof value === "number" ? formatMoney(value, { decimals: 0 }) : String(value)
            }
            labelFormatter={(label) =>
              typeof label === "number" ? formatLongDate(new Date(label)) : String(label)
            }
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={lowestPoint.date}
            y={lowestPoint.balance}
            r={4}
            fill={lineColor}
            stroke="var(--background)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
