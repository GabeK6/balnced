"use client";

import { useMemo } from "react";
import { formatMoney } from "@/lib/dashboard-data";
import type { ExpenseCategoryOption } from "@/lib/expense-smart-category";
import {
  budgetsForMonth,
  categoriesWithBudgetsFirst,
  yearMonthKey,
  type CategoryBudgetsByMonth,
} from "@/lib/expense-category-budgets";
import { getThisMonthCategoryTotals } from "@/lib/expense-dashboard-summaries";
import type { Expense } from "@/lib/dashboard-data";

type Props = {
  expenses: Expense[];
  now: Date;
  budgets: CategoryBudgetsByMonth;
  onBudgetChange: (category: ExpenseCategoryOption, value: string) => void;
};

export default function ExpensesProBudgetsPanel({
  expenses,
  now,
  budgets,
  onBudgetChange,
}: Props) {
  const ym = yearMonthKey(now);
  const monthBudgets = budgetsForMonth(budgets, ym);
  const spent = useMemo(() => getThisMonthCategoryTotals(expenses, now), [expenses, now]);
  const order = useMemo(() => categoriesWithBudgetsFirst(monthBudgets), [monthBudgets]);

  return (
    <section className="balnced-panel rounded-2xl p-5 sm:p-6" aria-label="Category budgets">
      <div className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/75">
          Pro · Budgets
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          Monthly category budgets
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Set a cap per category for this calendar month. Progress uses expenses logged this month.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {order.map((cat) => {
          const cap = monthBudgets[cat] ?? 0;
          const s = spent[cat] ?? 0;
          const pct = cap > 0 ? Math.min(100, Math.round((s / cap) * 100)) : 0;
          const over = cap > 0 && s > cap;
          return (
            <div
              key={cat}
              className="rounded-xl border border-white/[0.06] bg-slate-950/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{cat}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Spent {formatMoney(s)}
                    {cap > 0 ? (
                      <>
                        {" "}
                        · {pct}% of {formatMoney(cap)}
                      </>
                    ) : (
                      " · no cap set"
                    )}
                  </p>
                </div>
                <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                  <span className="sr-only">Budget for {cat}</span>
                  <span>Monthly cap</span>
                  <input
                    key={`${ym}-${cat}-${cap}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    defaultValue={cap > 0 ? String(cap) : ""}
                    onBlur={(e) => onBudgetChange(cat, e.target.value)}
                    className="balnced-input w-28 py-2 text-sm"
                  />
                </label>
              </div>
              {cap > 0 ? (
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cat} budget ${pct} percent used`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      over
                        ? "bg-gradient-to-r from-rose-500 to-amber-500"
                        : "bg-gradient-to-r from-emerald-500 to-teal-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
