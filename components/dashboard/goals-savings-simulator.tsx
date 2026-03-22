"use client";

import { SlidersHorizontal } from "lucide-react";
import { formatMoney, formatDateMonthYear } from "@/lib/dashboard-data";

type Props = {
  /** Monthly savings from saved save % (baseline) */
  baselineMonthly: number;
  sliderMin: number;
  sliderMax: number;
  /** Controlled simulated value (clamped) */
  simulatedMonthly: number;
  onSimulatedChange: (value: number) => void;
  onReset: () => void;
  isDirty: boolean;
  /** First priority goal headline */
  firstGoalName: string | null;
  simTargetDate: Date | null;
  /** Months sooner (positive) or later (negative) vs baseline for first goal; null if not comparable */
  firstGoalMonthsDeltaVsBaseline: number | null;
};

export default function GoalsSavingsSimulator({
  baselineMonthly,
  sliderMin,
  sliderMax,
  simulatedMonthly,
  onSimulatedChange,
  onReset,
  isDirty,
  firstGoalName,
  simTargetDate,
  firstGoalMonthsDeltaVsBaseline,
}: Props) {
  const clamped = Math.min(sliderMax, Math.max(sliderMin, simulatedMonthly));
  const showComparison =
    firstGoalName &&
    simTargetDate &&
    firstGoalMonthsDeltaVsBaseline != null &&
    baselineMonthly > 0;

  return (
    <section
      className="rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-950/40 via-slate-900/45 to-slate-950/60 p-6 sm:p-7 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-300 ease-out motion-reduce:transition-none hover:border-violet-400/40 sm:hover:-translate-y-0.5 sm:hover:shadow-lg sm:hover:shadow-black/25"
      aria-labelledby="goals-savings-sim-heading"
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-200"
            aria-hidden
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-violet-200/80">
              What-if simulator
            </p>
            <h2
              id="goals-savings-sim-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-slate-50"
            >
              Try a monthly savings rate
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              <span className="text-slate-400">Doesn’t change your saved plan.</span> Dates and pacing
              below update instantly.
            </p>
          </div>
        </div>
        {isDirty ? (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/10 active:scale-95"
          >
            Reset ({formatMoney(Math.round(baselineMonthly))}/mo)
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="goals-savings-sim-slider" className="text-[0.65rem] font-semibold uppercase tracking-wider text-violet-200/70">
            Monthly savings (preview)
          </label>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-violet-50 sm:text-3xl" aria-live="polite">
            {formatMoney(Math.round(clamped))}
            <span className="text-base font-semibold text-slate-500 sm:text-lg">/mo</span>
          </span>
        </div>
        <input
          id="goals-savings-sim-slider"
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={25}
          value={clamped}
          onChange={(e) => onSimulatedChange(Number(e.target.value))}
          className="mt-4 h-2.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-violet-500 ring-1 ring-white/10 transition hover:ring-violet-500/20"
        />
        <div className="mt-1 flex justify-between text-[0.7rem] tabular-nums text-slate-500">
          <span>{formatMoney(sliderMin)}</span>
          <span>{formatMoney(sliderMax)}</span>
        </div>
      </div>

      {firstGoalName && simTargetDate && clamped > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium leading-snug text-slate-200" aria-live="polite">
            At {formatMoney(Math.round(clamped))}/mo →{" "}
            <span className="text-violet-200">{firstGoalName}</span> ready by{" "}
            <span className="tabular-nums text-emerald-300">
              {formatDateMonthYear(simTargetDate)}
            </span>
            .
          </p>
          {showComparison ? (
            <p className="text-sm leading-snug text-slate-400">
              {firstGoalMonthsDeltaVsBaseline > 0 ? (
                <>
                  You finish{" "}
                  <span className="font-semibold tabular-nums text-emerald-300">
                    {firstGoalMonthsDeltaVsBaseline} month
                    {firstGoalMonthsDeltaVsBaseline !== 1 ? "s" : ""} earlier
                  </span>{" "}
                  on that goal than at your current save rate (
                  {formatMoney(Math.round(baselineMonthly))}/mo).
                </>
              ) : firstGoalMonthsDeltaVsBaseline < 0 ? (
                <>
                  That’s{" "}
                  <span className="font-semibold tabular-nums text-amber-200">
                    {Math.abs(firstGoalMonthsDeltaVsBaseline)} month
                    {Math.abs(firstGoalMonthsDeltaVsBaseline) !== 1 ? "s" : ""} later
                  </span>{" "}
                  than at your current save rate ({formatMoney(Math.round(baselineMonthly))}/mo).
                </>
              ) : (
                <>Same timing as your current save rate for that goal.</>
              )}
            </p>
          ) : baselineMonthly <= 0 ? (
            <p className="text-sm text-slate-500">
              Set save % in your plan summary to compare against your planned monthly savings.
            </p>
          ) : null}
        </div>
      ) : clamped <= 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Move the slider above $0 to see how faster funding changes your first goal’s date.
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Name your top priority goal and set an amount to see a target month.
        </p>
      )}
    </section>
  );
}
