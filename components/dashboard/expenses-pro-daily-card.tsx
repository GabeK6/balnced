"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { ExpensesSafeGuidance } from "@/lib/expense-dashboard-summaries";
import { computeProEnhancedDailyLimit } from "@/lib/expense-pro-daily";

type Props = {
  guidance: ExpensesSafeGuidance;
  now?: Date;
};

export default function ExpensesProDailyCard({ guidance, now = new Date() }: Props) {
  const pro = computeProEnhancedDailyLimit(guidance, now);

  if (!guidance.canCompute) {
    return (
      <div className="balnced-panel rounded-2xl p-5 sm:p-6">
        <p className="text-sm text-slate-500">Add income and payday on Overview to unlock daily limits.</p>
      </div>
    );
  }

  return (
    <section className="balnced-panel rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 via-slate-950/80 to-slate-950 p-5 sm:p-6">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
        Pro · Daily limit
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
        Enhanced safe-to-spend pace
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
        Blends runway until payday with the rest of this calendar month and nudges based on how fast
        you&apos;re spending vs a simple plan (after bills &amp; goals).
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            Runway / day
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-slate-50">
            {formatMoney(pro.runwayDaily)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">Until payday</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            Month / day
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-slate-50">
            {formatMoney(pro.monthCalendarDaily)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">Spread to month-end</p>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-200/90">
            Suggested pace
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-emerald-100">
            {formatMoney(pro.adjustedDaily)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-200/70">Use as a daily guide</p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">{pro.paceNote}</p>
    </section>
  );
}
