"use client";

import { useMemo } from "react";
import {
  formatExpenseDateTime,
  formatMoney,
  type Expense,
} from "@/lib/dashboard-data";
import {
  getExpenseEntryContext,
  localDayKeyFromExpense,
  sumExpensesByLocalDay,
} from "@/lib/expense-entry-context";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

type Props = {
  expenses: Expense[];
  categoryTotalsAllTime: Record<string, number>;
  limit?: number;
  onDelete: (id: string) => void;
};

function categoryLabel(e: Expense): string {
  const c = e.category?.trim();
  return c && c.length > 0 ? c : "Other";
}

export default function RecentExpensesList({
  expenses,
  categoryTotalsAllTime,
  limit = 20,
  onDelete,
}: Props) {
  const dayTotals = useMemo(() => sumExpensesByLocalDay(expenses), [expenses]);

  const rows = useMemo(() => {
    return expenses.slice(0, limit).map((expense) => {
      const cat = categoryLabel(expense);
      const dayKey = localDayKeyFromExpense(expense.created_at);
      const dayTotal = dayKey ? (dayTotals[dayKey] ?? 0) : 0;
      const catTotal = categoryTotalsAllTime[cat] ?? 0;
      const ctx = getExpenseEntryContext(expense, dayTotal, catTotal);
      return { expense, cat, ctx };
    });
  }, [expenses, limit, dayTotals, categoryTotalsAllTime]);

  if (expenses.length === 0) {
    return (
      <div className="mt-4">
        <SectionEmptyState
          title="No expenses yet"
          description="Start tracking to unlock insights and your category mix."
          example="e.g. Groceries — $62"
          actionLabel="Add expense"
          actionHref="#add-expense"
        />
      </div>
    );
  }

  return (
    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
      {rows.map(({ expense, cat, ctx }) => {
        const contextParts: string[] = [];
        if (ctx.pctOfDay != null) {
          contextParts.push(`${ctx.pctOfDay}% of same-day spend`);
        }
        if (ctx.pctOfCategory != null) {
          contextParts.push(`${ctx.pctOfCategory}% of ${cat} total`);
        }
        const contextLine = contextParts.join(" · ");

        return (
          <div
            key={expense.id}
            className="balnced-row rounded-xl px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {expense.name}
                  </p>
                  {ctx.isHighSpend ? (
                    <span
                      className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200/95 ring-1 ring-amber-500/25"
                      title="Large relative to that day or category"
                    >
                      High
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-medium text-slate-300">
                    {cat}
                  </span>
                  <span className="text-slate-600" aria-hidden>
                    ·
                  </span>
                  <time
                    dateTime={expense.created_at}
                    className="tabular-nums text-slate-400"
                  >
                    {formatExpenseDateTime(expense.created_at)}
                  </time>
                </div>
                {contextLine ? (
                  <p className="mt-2 text-[11px] leading-snug text-slate-500">
                    {contextLine}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-bold tabular-nums text-slate-50">
                  {formatMoney(Number(expense.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(expense.id)}
                  className="rounded-lg bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-900/50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
