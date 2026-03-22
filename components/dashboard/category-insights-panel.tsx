"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { CategoryInsightsSnapshot } from "@/lib/expense-dashboard-summaries";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

type Props = {
  loading: boolean;
  insights: CategoryInsightsSnapshot | null;
};

export default function CategoryInsightsPanel({ loading, insights }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 transition-all duration-300 sm:p-6">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-800" />
        <div className="mt-2 h-6 w-48 animate-pulse rounded bg-slate-800/90" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-slate-800/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!insights || insights.ranked.length === 0) {
    return (
      <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] sm:p-6">
        <header className="border-b border-white/[0.06] pb-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Insights
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
            Category insights
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
            This month vs last month. Log expenses to see your mix.
          </p>
        </header>
        <div className="mt-5">
          <SectionEmptyState
            title="No spending this month"
            description="Add dated expenses to see rankings and your food share."
            example="e.g. This month’s top category appears here."
            actionLabel="Add expense"
            actionHref="#add-expense"
          />
        </div>
      </div>
    );
  }

  const maxAmt = insights.ranked[0]?.amount ?? 1;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] sm:p-6">
      <header className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Insights
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          Category insights
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          This month’s mix vs last month. Bars show share of this month’s total.
        </p>
      </header>

      <div className="mt-4 balnced-row rounded-xl p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Spent this month
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
          {formatMoney(insights.monthTotal)}
        </p>
      </div>

      {insights.top ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-200">
          Your highest spending category is{" "}
          <span className="font-semibold text-white">{insights.top.name}</span>{" "}
          (
          <span className="tabular-nums text-slate-300">
            {insights.top.pctOfMonth}%
          </span>{" "}
          of this month).
          {insights.canComparePriorMonth && insights.top.higherThanTypical ? (
            <span className="text-amber-200/95">
              {" "}
              This is higher than typical for you.
            </span>
          ) : null}
        </p>
      ) : null}

      {insights.food ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          You spend{" "}
          <span className="font-semibold tabular-nums text-white">
            {insights.food.pct}%
          </span>{" "}
          on food (groceries + dining out).
          {insights.canComparePriorMonth &&
          insights.food.priorMonthPct !== null ? (
            <span className="text-slate-500">
              {" "}
              Last month: {insights.food.priorMonthPct}%.
            </span>
          ) : null}
          {insights.canComparePriorMonth && insights.food.higherThanTypical ? (
            <span className="text-amber-200/95">
              {" "}
              This is higher than typical.
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pr-1">
        {insights.ranked.map((row, i) => {
          const widthPct = Math.max(8, (row.amount / maxAmt) * 100);
          const isTop = i === 0;
          return (
            <div
              key={row.name}
              className={`relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors duration-200 ${
                isTop
                  ? "border-sky-500/25 bg-sky-950/25 hover:border-sky-500/35"
                  : row.higherThanTypical
                    ? "border-amber-500/20 bg-amber-950/15 hover:border-amber-500/30"
                    : "border-white/[0.06] bg-slate-950/35 hover:border-white/[0.12]"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 opacity-[0.14] ${
                  isTop
                    ? "bg-sky-500"
                    : row.higherThanTypical
                      ? "bg-amber-500"
                      : "bg-slate-500"
                }`}
                style={{ width: `${widthPct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-slate-100">
                    {row.name}
                  </span>
                  {row.higherThanTypical && insights.canComparePriorMonth ? (
                    <span className="ml-2 inline-block rounded-md border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-amber-200/95">
                      Up vs last month
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-semibold tabular-nums text-slate-100">
                    {formatMoney(row.amount)}
                  </span>
                  <span className="ml-2 text-xs tabular-nums text-slate-500">
                    {row.pctOfMonth}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!insights.canComparePriorMonth ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Next month we&apos;ll compare your category mix to this month.
        </p>
      ) : null}
    </div>
  );
}
