"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { CategoryChartDatum } from "@/lib/expense-dashboard-summaries";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

type Props = {
  data: CategoryChartDatum[];
  monthTotal: number;
};

export default function ExpensesFreeCategoryList({ data, monthTotal }: Props) {
  if (!data.length || monthTotal <= 0) {
    return (
      <section
        className="rounded-2xl border border-dashed border-white/15 bg-slate-950/30 p-6 sm:p-8"
        aria-label="Spending by category"
      >
        <SectionEmptyState
          title="No spending this month"
          description="Log expenses dated this month to see categories here."
          example="e.g. Groceries — $42"
          actionLabel="Add expense"
          actionHref="#add-expense"
          align="center"
        />
      </section>
    );
  }

  return (
    <section
      className="balnced-panel rounded-2xl p-5 sm:p-6"
      aria-label="Spending by category this month"
    >
      <div className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Categories
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          This month by category
        </h2>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500 sm:text-sm">
          Amounts and share of month-to-date spending. Upgrade to Pro for charts, budgets, and
          smarter categorization.
        </p>
        <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
          {formatMoney(monthTotal)}
        </p>
      </div>
      <ul className="mt-5 space-y-2.5">
        {data.map((row) => (
          <li
            key={row.name}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-950/40 px-3 py-2.5"
          >
            <span className="truncate text-sm font-medium text-slate-200">{row.name}</span>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums text-white">{formatMoney(row.value)}</p>
              <p className="text-[11px] tabular-nums text-slate-500">{row.pct}%</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
