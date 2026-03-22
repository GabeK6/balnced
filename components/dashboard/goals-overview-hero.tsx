"use client";

import { Target } from "lucide-react";
import {
  formatMoney,
  formatDateMonthYear,
  type SavingsGoalItem,
  type SavingsGoalTimeline,
} from "@/lib/dashboard-data";
import { getGoalStatus } from "@/lib/financial-status";

function pacePercent(amount: number, monthlySavings: number): number {
  if (amount <= 0 || monthlySavings <= 0) return 0;
  return Math.min(100, Math.round((monthlySavings / amount) * 100));
}

function statusPresentation(gs: { status: string; label: string }): {
  headline: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (gs.status) {
    case "strong":
      return {
        headline: "On Track",
        badgeClass: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/25",
        dotClass: "bg-emerald-400",
      };
    case "on_track":
      return {
        headline: "Needs Attention",
        badgeClass: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
        dotClass: "bg-amber-400",
      };
    case "behind":
      return {
        headline: "Behind",
        badgeClass: "bg-rose-500/15 text-rose-100 ring-rose-500/25",
        dotClass: "bg-rose-400",
      };
    default:
      return {
        headline: gs.label,
        badgeClass: "bg-slate-500/15 text-slate-200 ring-white/15",
        dotClass: "bg-slate-400",
      };
  }
}

type Props = {
  primaryGoal: SavingsGoalItem | null;
  timeline: SavingsGoalTimeline | null;
  monthlySavings: number;
};

export default function GoalsOverviewHero({ primaryGoal, timeline, monthlySavings }: Props) {
  const filled =
    primaryGoal != null &&
    primaryGoal.name.trim().length > 0 &&
    Number(primaryGoal.amount) > 0;

  const amount = timeline?.amount ?? (primaryGoal ? Number(primaryGoal.amount) : 0);
  const pace = timeline && monthlySavings > 0 ? pacePercent(amount, monthlySavings) : 0;
  const goalStatus =
    timeline && monthlySavings > 0
      ? getGoalStatus(true, amount, timeline.months, monthlySavings)
      : null;
  const statusUi = goalStatus ? statusPresentation(goalStatus) : null;
  const barWidth = pace <= 0 ? 0 : Math.min(100, Math.max(4, pace));

  if (!filled) {
    return (
      <div className="balnced-panel rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-950 p-6 shadow-[0_24px_64px_-32px_rgba(0,0,0,0.75)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-emerald-300"
              aria-hidden
            >
              <Target className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Goals overview
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.75rem]">
                Build your savings plan
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                Add a priority goal and target amount below — your overview will show progress, timing,
                and pacing here.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="balnced-panel rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-slate-900/60 to-slate-950 p-6 shadow-[0_24px_64px_-28px_rgba(16,185,129,0.18)] sm:p-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                aria-hidden
              >
                <Target className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
                  Goals overview
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.75rem]">
                  {primaryGoal.name.trim()}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Priority goal · waterfall funding (100% to this goal until funded, then the next).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                Target amount
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-50 sm:text-2xl">
                {formatMoney(amount)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                Target date
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-emerald-200/95 sm:text-2xl">
                {timeline ? formatDateMonthYear(timeline.targetDate) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                Monthly to this goal
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-50 sm:text-2xl">
                {monthlySavings > 0 ? formatMoney(monthlySavings) : "—"}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                While it’s #1, the full save rate funds here.
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                Progress signal
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-50 sm:text-2xl">
                {monthlySavings > 0 ? `${pace}%` : "—"}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">
                One month of saving covers this share of the target.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 rounded-2xl border border-white/[0.1] bg-slate-950/40 p-5 backdrop-blur-md sm:p-6 lg:max-w-[min(100%,320px)] lg:self-stretch">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            Plan status
          </p>
          <div className="mt-4 flex items-center gap-2">
            {statusUi ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusUi.badgeClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusUi.dotClass}`}
                  aria-hidden
                />
                {statusUi.headline}
              </span>
            ) : (
              <span className="text-sm text-slate-500">Set save % to score pacing</span>
            )}
            <span
              className="ml-auto text-2xl font-semibold tabular-nums text-slate-100"
              aria-live="polite"
            >
              {monthlySavings > 0 ? `${pace}%` : "—"}
            </span>
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-900/90 ring-1 ring-white/5"
            role="progressbar"
            aria-valuenow={pace}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Monthly funding progress toward this goal"
          >
            <div
              className="h-full max-w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {timeline
              ? `About ${timeline.months} month${timeline.months !== 1 ? "s" : ""} of funding at your rate after earlier goals.`
              : "Complete your goal details to estimate timing."}
          </p>
        </div>
      </div>
    </div>
  );
}
