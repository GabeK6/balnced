"use client";

import { SlidersHorizontal } from "lucide-react";

export type ContributionSimulatorMetrics = {
  /** Health / goal progress 0–100 */
  goalPct: number;
  projectedPortfolio: number | null;
  monthlyRetirementIncome: number;
};

type Props = {
  monthlyValue: number;
  onMonthlyChange: (value: number) => void;
  onReset: () => void;
  sliderMin: number;
  sliderMax: number;
  step?: number;
  baselineMonthly: number;
  isDirty: boolean;
  metrics: ContributionSimulatorMetrics;
  hasGoalTarget: boolean;
  formatMoney: (n: number) => string;
};

const KICKER =
  "text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500";

export default function ContributionSimulatorCard({
  monthlyValue,
  onMonthlyChange,
  onReset,
  sliderMin,
  sliderMax,
  step = 25,
  baselineMonthly,
  isDirty,
  metrics,
  hasGoalTarget,
  formatMoney,
}: Props) {
  const barPct = hasGoalTarget ? Math.min(100, Math.max(0, metrics.goalPct)) : 0;
  const barWidth = barPct <= 0 ? 0 : Math.min(100, Math.max(3, barPct));

  return (
    <section
      className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/35 via-slate-900/50 to-slate-950/60 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-6"
      aria-labelledby="contribution-simulator-heading"
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-200"
            aria-hidden
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-sky-200/80">
              What-if simulator
            </p>
            <h2
              id="contribution-simulator-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-slate-50"
            >
              Slide your monthly contribution
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Your <span className="text-slate-400">saved plan is unchanged</span>. This scales{' '}
              <span className="text-slate-400">your</span> deferrals only—employer match in the planner
              stays the same.
            </p>
          </div>
        </div>
        {isDirty ? (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            Reset to plan ({formatMoney(Math.round(baselineMonthly))}/mo)
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="contribution-sim-slider" className={`${KICKER} text-sky-200/70`}>
            Monthly contribution (employee)
          </label>
          <span className="text-lg font-semibold tabular-nums text-sky-100" aria-live="polite">
            {formatMoney(Math.round(monthlyValue))}
            <span className="text-sm font-medium text-slate-500">/mo</span>
          </span>
        </div>
        <input
          id="contribution-sim-slider"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={Math.min(sliderMax, Math.max(sliderMin, monthlyValue))}
          onChange={(e) => onMonthlyChange(Number(e.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-500 ring-1 ring-white/10"
        />
        <div className="mt-1 flex justify-between text-[0.7rem] tabular-nums text-slate-500">
          <span>{formatMoney(sliderMin)}</span>
          <span>{formatMoney(sliderMax)}</span>
        </div>
      </div>

      <p
        className="mt-4 text-sm font-medium leading-snug text-slate-200"
        aria-live="polite"
      >
        {hasGoalTarget ? (
          <>
            At {formatMoney(Math.round(monthlyValue))}/mo → You reach{" "}
            <span className="tabular-nums text-sky-300">{metrics.goalPct}%</span> of your goal.
          </>
        ) : (
          <>
            At {formatMoney(Math.round(monthlyValue))}/mo — add salary and ages to see goal progress.
          </>
        )}
      </p>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/5"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-400 transition-[width] duration-100 ease-out motion-reduce:transition-none"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className={KICKER}>Projected portfolio at retirement</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-50">
            {metrics.projectedPortfolio != null
              ? formatMoney(Math.round(metrics.projectedPortfolio))
              : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className={KICKER}>Est. total retirement income / mo</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-50">
            {formatMoney(Math.round(metrics.monthlyRetirementIncome))}
          </p>
          <p className="mt-1 text-[0.7rem] text-slate-500">Portfolio + SS + pension from your plan</p>
        </div>
      </div>
    </section>
  );
}
