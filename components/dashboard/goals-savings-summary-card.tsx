"use client";

import { Wallet } from "lucide-react";
import { formatMoney } from "@/lib/dashboard-data";

type Props = {
  savePercentInput: string;
  onSavePercentChange: (value: string) => void;
  monthlySavings: number;
  savingsRatePercent: number;
};

export default function GoalsSavingsSummaryCard({
  savePercentInput,
  onSavePercentChange,
  monthlySavings,
  savingsRatePercent,
}: Props) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-slate-900/35 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-emerald-300"
            aria-hidden
          >
            <Wallet className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Plan funding
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-100">
              Savings rate & monthly plan
            </h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
              Your save % sets how much goes to goals each month. The waterfall sends{" "}
              <span className="text-slate-400">100%</span> to priority #1 until it’s funded, then rolls to
              #2, and so on.
            </p>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto lg:min-w-[20rem] lg:grid-cols-2 lg:gap-5">
          <div>
            <label
              htmlFor="goals-save-pct-input"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Save % of take-home
            </label>
            <input
              id="goals-save-pct-input"
              type="number"
              step="0.5"
              min="0"
              max="100"
              placeholder="e.g. 15"
              value={savePercentInput}
              onChange={(e) => onSavePercentChange(e.target.value)}
              className="balnced-input mt-2 w-full"
            />
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-5 py-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-200/80">
              Planned monthly savings
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
              {formatMoney(monthlySavings)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Rate:{" "}
              <span className="font-semibold tabular-nums text-slate-300">
                {savingsRatePercent > 0 ? `${savingsRatePercent.toFixed(1)}%` : "—"}
              </span>{" "}
              of take-home
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
