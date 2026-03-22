"use client";

import { Lightbulb } from "lucide-react";
import GoalsAiStrategy, { type GoalsStrategyPayload } from "@/components/dashboard/goals-ai-strategy";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";
import { formatDateMonthYear, type SavingsGoalTimeline } from "@/lib/dashboard-data";

type Props = {
  firstGoalTimeline: SavingsGoalTimeline | null;
  firstGoalName: string | null;
  monthlySavings: number;
  savePercentEffective: number;
  aiPayload: GoalsStrategyPayload | null;
  proReady: boolean;
  isPro: boolean;
};

/**
 * Primary insight is always shown (rule-based). Pro AI sits secondary.
 */
export default function GoalsPlanInsights({
  firstGoalTimeline,
  firstGoalName,
  monthlySavings,
  savePercentEffective,
  aiPayload,
  proReady,
  isPro,
}: Props) {
  let primaryLine: string | null = null;
  if (firstGoalTimeline && firstGoalName && monthlySavings > 0) {
    primaryLine = `At your current rate, you could reach “${firstGoalName.trim()}” in about ${firstGoalTimeline.months} months (around ${formatDateMonthYear(firstGoalTimeline.targetDate)}).`;
  } else if (savePercentEffective <= 0 || monthlySavings <= 0) {
    primaryLine =
      "Set a savings rate above to see when you can reach your goals — we’ll estimate months and target dates from your waterfall.";
  } else if (!firstGoalTimeline || !firstGoalName) {
    primaryLine = "Add a name and target amount for your top priority goal to unlock a personalized timeline.";
  }

  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-slate-900/40 to-slate-950 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] sm:p-7"
        aria-labelledby="goals-primary-insight-heading"
      >
        <div className="flex gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200"
            aria-hidden
          >
            <Lightbulb className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p
              id="goals-primary-insight-heading"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-200/85"
            >
              Insight
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-50">
              Your plan at a glance
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{primaryLine}</p>
          </div>
        </div>
      </section>

      <div className="relative">
        {!proReady ? (
          <div className={`min-h-[8rem] rounded-2xl ${PRO_GATING_PLACEHOLDER_CLASS}`} aria-hidden />
        ) : isPro && aiPayload ? (
          <div className="space-y-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Deeper ideas
            </p>
            <GoalsAiStrategy payload={aiPayload} />
          </div>
        ) : !isPro ? (
          <ProFeatureTeaser title="AI goal strategy" surface="goals_ai" />
        ) : null}
      </div>
    </div>
  );
}
