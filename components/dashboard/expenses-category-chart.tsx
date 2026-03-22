"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/dashboard-data";
import type { CategoryChartDatum } from "@/lib/expense-dashboard-summaries";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

const SLICE_COLORS = [
  "#34d399",
  "#38bdf8",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#94a3b8",
];

type Props = {
  data: CategoryChartDatum[];
  loading: boolean;
  monthTotal: number;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CategoryChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="font-semibold text-slate-100">{row.name}</p>
      <p className="mt-0.5 tabular-nums text-slate-300">
        {formatMoney(row.value)}
        <span className="text-slate-500"> · </span>
        {row.pct}%
      </p>
    </div>
  );
}

export default function ExpensesCategoryChart({ data, loading, monthTotal }: Props) {
  if (loading) {
    return (
      <div className="balnced-panel rounded-2xl p-5 sm:p-6">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
        <div className="mt-3 h-6 w-48 animate-pulse rounded bg-slate-800/90" />
        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
          <div className="mx-auto h-[240px] w-full max-w-[280px] animate-pulse rounded-full bg-slate-800/50 sm:h-[260px]" />
          <div className="min-w-0 flex-1 space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-800/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data.length || monthTotal <= 0) {
    return (
      <section
        className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-6 transition-colors duration-300 hover:border-white/20 sm:p-8"
        aria-label="Spending by category"
      >
        <SectionEmptyState
          title="No spending this month"
          description="Log expenses dated this month to see the category split."
          example="e.g. Restaurants — $28"
          actionLabel="Add expense"
          actionHref="#add-expense"
          align="center"
        />
      </section>
    );
  }

  return (
    <section
      className="balnced-panel rounded-2xl p-5 transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] sm:p-6"
      aria-label="Spending by category this month"
    >
      <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Chart
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
            Spending by category
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Share of your month-to-date total. Updates when you add or remove expenses.
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Month to date
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
            {formatMoney(monthTotal)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="mx-auto h-[240px] w-full max-w-[280px] shrink-0 sm:h-[260px] sm:max-w-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                stroke="rgba(15,23,42,0.85)"
                strokeWidth={1}
              >
                {data.map((row, i) => (
                  <Cell key={row.name} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5" aria-label="Category amounts and percentages">
          {data.map((row, i) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-950/40 px-3 py-2.5 transition-colors duration-200 hover:border-white/[0.12] hover:bg-slate-900/50"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium text-slate-200">{row.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold tabular-nums tracking-tight text-white">
                  {formatMoney(row.value)}
                </p>
                <p className="text-[11px] tabular-nums text-slate-500">{row.pct}% of month</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
