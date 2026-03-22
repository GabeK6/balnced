"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/dashboard-data";
import { dailyTotalSpendSeries } from "@/lib/expense-pro-insights";
import type { Expense } from "@/lib/dashboard-data";

type Props = {
  expenses: Expense[];
  days?: number;
};

export default function ExpensesSpendingLineChart({ expenses, days = 30 }: Props) {
  const now = new Date();
  const series = dailyTotalSpendSeries(expenses, now, days);
  const hasAny = series.some((d) => d.amount > 0);

  return (
    <div className="balnced-panel rounded-2xl p-5 sm:p-6">
      <div className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Trends
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          Spending over time
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Total logged per day (last {days} days).
        </p>
      </div>
      <div className="mt-4 h-64 min-h-[16rem] rounded-xl balnced-row">
        {!hasAny ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
            No expenses in this window yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="0" stroke="#334155" strokeOpacity={0.45} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { date: string; label: string; amount: number };
                  return (
                    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
                      <p className="text-slate-400">
                        {new Date(row.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="mt-1 font-semibold tabular-nums text-slate-100">
                        {formatMoney(row.amount)}
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
