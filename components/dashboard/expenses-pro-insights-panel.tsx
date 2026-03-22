"use client";

import { computeProSpendingInsights } from "@/lib/expense-pro-insights";
import type { Expense } from "@/lib/dashboard-data";

type Props = {
  expenses: Expense[];
  now: Date;
};

export default function ExpensesProInsightsPanel({ expenses, now }: Props) {
  const insight = computeProSpendingInsights(expenses, now);
  const lines: string[] = [];
  if (insight.wowLine) lines.push(insight.wowLine);
  if (insight.spikeLine) lines.push(insight.spikeLine);
  for (const u of insight.unusualLines) lines.push(u);

  return (
    <section className="balnced-panel rounded-2xl p-5 sm:p-6" aria-label="Spending insights">
      <div className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/75">
          Pro · Insights
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          Spending insights
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Week-over-week movement, category swings, and expenses that stand out vs typical.
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">
          Add a bit more history this month to unlock comparisons and pattern notes.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {lines.map((line, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-white/[0.06] bg-slate-950/40 px-4 py-3 text-sm leading-relaxed text-slate-300"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
