"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  loadUserGoals,
  saveUserGoals,
  getSavingsGoalTimelines,
  getMonthlyPay,
  formatDateMonthYear,
  getEffectiveSavingsGoals,
  withSyncedLegacyBigPurchase,
  type UserGoals,
  type SavingsGoalItem,
  type SavingsGoalDraftPatch,
  type Budget,
} from "@/lib/dashboard-data";
import GoalsTimeline from "@/components/dashboard/goals-timeline";
import GoalsSavingsSimulator from "@/components/dashboard/goals-savings-simulator";
import SavingsFlowVisual from "@/components/dashboard/savings-flow-visual";
import GoalsOverviewHero from "@/components/dashboard/goals-overview-hero";
import GoalsSavingsSummaryCard from "@/components/dashboard/goals-savings-summary-card";
import GoalsPlanInsights from "@/components/dashboard/goals-plan-insights";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";
import { useUserPlan } from "@/hooks/use-user-plan";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";

function newGoalDraft(priority: number): SavingsGoalItem {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `g-${Date.now()}`,
    name: "",
    amount: 0,
    priority,
  };
}

function sortAndRenumberDrafts(drafts: SavingsGoalItem[]): SavingsGoalItem[] {
  return [...drafts]
    .sort((a, b) => a.priority - b.priority)
    .map((g, i) => ({ ...g, priority: i + 1 }));
}

const SECTION = "space-y-8 sm:space-y-10";

export default function GoalsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [goals, setGoals] = useState<UserGoals>({
    retirement_age: 65,
    invest_percent: undefined,
    save_percent: undefined,
    big_purchase_name: null,
    big_purchase_amount: null,
  });
  const [goalDrafts, setGoalDrafts] = useState<SavingsGoalItem[]>([newGoalDraft(1)]);
  const [savePercentInput, setSavePercentInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const { hasProAccess, loading: planLoading } = useUserPlan();
  const proReady = !planLoading;
  const isPro = proReady && hasProAccess;

  const loadData = useCallback(async () => {
    const data = await loadDashboardData();
    if (!data.user) {
      window.location.href = "/login";
      return;
    }
    setUserId(data.user.id);
    setBudget(data.budget);
    const saved = loadUserGoals(data.user.id);
    if (saved) {
      setGoals(saved);
      const eff = getEffectiveSavingsGoals(saved);
      setGoalDrafts(
        eff.length > 0 ? sortAndRenumberDrafts(eff.map((g) => ({ ...g }))) : [newGoalDraft(1)]
      );
      setSavePercentInput(saved.save_percent != null ? String(saved.save_percent) : "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateDraft = (id: string, patch: SavingsGoalDraftPatch) => {
    setGoalDrafts((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g))
    );
  };

  const addGoalRow = () => {
    setGoalDrafts((prev) => {
      const sorted = sortAndRenumberDrafts(prev);
      const nextP = sorted.length + 1;
      return [...sorted, newGoalDraft(nextP)];
    });
  };

  const removeGoalRow = (id: string) => {
    setGoalDrafts((prev) => {
      const next = prev.filter((g) => g.id !== id);
      return next.length ? sortAndRenumberDrafts(next) : [newGoalDraft(1)];
    });
  };

  const moveGoal = (id: string, dir: -1 | 1) => {
    setGoalDrafts((prev) => {
      const sorted = sortAndRenumberDrafts(prev);
      const idx = sorted.findIndex((g) => g.id === id);
      if (idx < 0) return prev;
      const j = idx + dir;
      if (j < 0 || j >= sorted.length) return prev;
      const copy = [...sorted];
      const tmp = copy[idx].priority;
      copy[idx] = { ...copy[idx], priority: copy[j].priority };
      copy[j] = { ...copy[j], priority: tmp };
      return sortAndRenumberDrafts(copy);
    });
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    const current = loadUserGoals(userId);
    const rawSavePct =
      savePercentInput !== ""
        ? Number(savePercentInput)
        : current?.save_percent ?? 0;
    const clampedSavePct =
      Number.isFinite(rawSavePct) && rawSavePct > 0
        ? Math.min(100, Math.max(0, rawSavePct))
        : 0;

    const validGoals = sortAndRenumberDrafts(goalDrafts).filter(
      (g) => g.name.trim().length > 0 && Number(g.amount) > 0
    );

    const next = withSyncedLegacyBigPurchase({
      retirement_age: current?.retirement_age ?? 65,
      invest_percent: current?.invest_percent,
      save_percent: clampedSavePct || undefined,
      savings_goals: validGoals.length ? validGoals.map((g, i) => ({ ...g, priority: i + 1 })) : undefined,
    });

    saveUserGoals(userId, next);
    setGoals(next);
    setGoalDrafts(
      validGoals.length > 0
        ? validGoals.map((g, i) => ({ ...g, priority: i + 1 }))
        : [newGoalDraft(1)]
    );
    setSavePercentInput(next.save_percent != null ? String(next.save_percent) : "");
    setSaving(false);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  };

  const monthlyPay = getMonthlyPay(budget);
  const activeSavePct =
    savePercentInput !== ""
      ? Number(savePercentInput)
      : goals.save_percent ?? 0;
  const normalizedSavePct =
    Number.isFinite(activeSavePct) && activeSavePct > 0
      ? Math.min(100, Math.max(0, activeSavePct))
      : 0;
  const monthlySavingsFromSave =
    budget && normalizedSavePct > 0
      ? monthlyPay * (normalizedSavePct / 100)
      : 0;

  const previewGoals = useMemo((): UserGoals => {
    const valid = sortAndRenumberDrafts(goalDrafts).filter(
      (g) => g.name.trim().length > 0 && Number(g.amount) > 0
    );
    return {
      ...goals,
      save_percent: normalizedSavePct || goals.save_percent,
      savings_goals: valid.length ? valid : undefined,
    };
  }, [goals, goalDrafts, normalizedSavePct]);

  const previewGoalsKey = useMemo(() => {
    const v = sortAndRenumberDrafts(goalDrafts).filter(
      (g) => g.name.trim().length > 0 && Number(g.amount) > 0
    );
    return `${normalizedSavePct}:${v.map((g) => `${g.id}:${g.amount}:${g.priority}`).join("|")}`;
  }, [goalDrafts, normalizedSavePct]);

  const [savingsSimOverride, setSavingsSimOverride] = useState<number | null>(null);

  useEffect(() => {
    setSavingsSimOverride(null);
  }, [previewGoalsKey, monthlySavingsFromSave]);

  const savingsSimSliderMax = useMemo(() => {
    const b = Math.max(0, monthlySavingsFromSave);
    return Math.min(8000, Math.max(2000, Math.ceil((b + 150) / 50) * 50));
  }, [monthlySavingsFromSave]);

  const effectiveSavingsSimMonthly =
    savingsSimOverride !== null ? savingsSimOverride : monthlySavingsFromSave;

  const baselineTimelines = useMemo(
    () => getSavingsGoalTimelines(budget, previewGoals, monthlySavingsFromSave),
    [budget, previewGoals, monthlySavingsFromSave]
  );
  const baselineTimelineById = useMemo(
    () => new Map(baselineTimelines.map((t) => [t.id, t] as const)),
    [baselineTimelines]
  );

  const simTimelines = useMemo(
    () =>
      getSavingsGoalTimelines(
        budget,
        previewGoals,
        Math.max(0, effectiveSavingsSimMonthly)
      ),
    [budget, previewGoals, effectiveSavingsSimMonthly]
  );
  const timelineById = useMemo(
    () => new Map(simTimelines.map((t) => [t.id, t] as const)),
    [simTimelines]
  );

  const sortedDrafts = sortAndRenumberDrafts(goalDrafts);

  const firstFilledGoal = sortedDrafts.find(
    (g) => g.name.trim().length > 0 && Number(g.amount) > 0
  );
  const firstSimT = firstFilledGoal ? timelineById.get(firstFilledGoal.id) : null;
  const firstBaseT = firstFilledGoal ? baselineTimelineById.get(firstFilledGoal.id) : null;
  const firstGoalSimDeltaMonths =
    firstSimT && firstBaseT ? firstBaseT.months - firstSimT.months : null;

  const aiStrategyPayload = useMemo(() => {
    const valid = sortAndRenumberDrafts(goalDrafts).filter(
      (g) => g.name.trim().length > 0 && Number(g.amount) > 0
    );
    if (!valid.length) return null;
    return {
      monthlyTakeHome: monthlyPay,
      savePercent: normalizedSavePct,
      monthlySavingsPlan: monthlySavingsFromSave,
      goals: valid.map((g) => {
        const t = baselineTimelineById.get(g.id);
        return {
          priority: g.priority,
          name: g.name.trim(),
          amount: Number(g.amount),
          monthsToFund: t != null ? t.months : null,
          targetMonthLabel: t ? formatDateMonthYear(t.targetDate) : null,
        };
      }),
    };
  }, [
    goalDrafts,
    normalizedSavePct,
    monthlyPay,
    monthlySavingsFromSave,
    baselineTimelineById,
  ]);

  if (loading) {
    return (
      <DashboardShell
        title=""
        subtitle=""
        compact
        headerOverride={
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Breadcrumb">
            <Link
              href="/dashboard"
              className="text-slate-500 transition-colors duration-150 hover:text-slate-300 motion-reduce:transition-none"
            >
              Overview
            </Link>
            <span className="text-slate-600" aria-hidden>
              /
            </span>
            <span className="font-medium text-slate-200" aria-current="page">
              Goals
            </span>
          </nav>
        }
      >
        <div className="balnced-panel rounded-3xl p-6 sm:p-8">
          <p className="text-slate-400">Loading your goals...</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Breadcrumb">
          <Link
            href="/dashboard"
            className="text-slate-500 transition-colors duration-150 hover:text-slate-300 motion-reduce:transition-none"
          >
            Overview
          </Link>
          <span className="text-slate-600" aria-hidden>
            /
          </span>
          <span className="font-medium text-slate-200" aria-current="page">
            Goals
          </span>
        </nav>
      }
    >
      <form onSubmit={handleSaveGoals} className={SECTION}>
        <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Goals
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              A single plan for your savings waterfall — fund priorities in order, then tune what-if
              scenarios and insights.
            </p>
          </div>
        </div>

        <GoalsOverviewHero
          primaryGoal={firstFilledGoal ?? null}
          timeline={firstSimT ?? null}
          monthlySavings={effectiveSavingsSimMonthly}
        />

        <GoalsSavingsSummaryCard
          savePercentInput={savePercentInput}
          onSavePercentChange={setSavePercentInput}
          monthlySavings={monthlySavingsFromSave}
          savingsRatePercent={normalizedSavePct}
        />

        <section className="space-y-5" aria-label="Savings flow">
          {savingsSimOverride !== null ? (
            <p className="rounded-2xl border border-violet-500/30 bg-violet-950/35 px-5 py-3.5 text-center text-xs leading-relaxed text-violet-100/90 shadow-sm transition-opacity duration-300">
              Previewing a different monthly rate—your{" "}
              <span className="font-medium text-slate-200">save %</span> is unchanged until you click{" "}
              <span className="font-medium text-slate-200">Save plan</span>.
            </p>
          ) : null}

          {proReady ? (
            isPro ? (
              <GoalsSavingsSimulator
                baselineMonthly={monthlySavingsFromSave}
                sliderMin={0}
                sliderMax={savingsSimSliderMax}
                simulatedMonthly={Math.min(
                  savingsSimSliderMax,
                  Math.max(0, effectiveSavingsSimMonthly)
                )}
                onSimulatedChange={(v) => setSavingsSimOverride(v)}
                onReset={() => setSavingsSimOverride(null)}
                isDirty={savingsSimOverride !== null}
                firstGoalName={firstFilledGoal?.name.trim() ?? null}
                simTargetDate={firstSimT?.targetDate ?? null}
                firstGoalMonthsDeltaVsBaseline={firstGoalSimDeltaMonths}
              />
            ) : (
              <ProFeatureTeaser title="What-if savings simulator" surface="goals_sim" />
            )
          ) : (
            <div className={PRO_GATING_PLACEHOLDER_CLASS} aria-hidden />
          )}

          <SavingsFlowVisual
            monthlySavings={effectiveSavingsSimMonthly}
            monthlyTakeHome={monthlyPay}
            sortedDrafts={sortedDrafts}
            timelineById={timelineById}
          />
        </section>

        <section id="goals-plan" className="scroll-mt-6">
          <div className="balnced-panel rounded-3xl p-6 sm:p-8">
            <GoalsTimeline
              sortedDrafts={sortedDrafts}
              timelineById={timelineById}
              monthlySavingsFromSave={effectiveSavingsSimMonthly}
              monthlyTakeHome={monthlyPay}
              updateDraft={updateDraft}
              moveGoal={moveGoal}
              removeGoalRow={removeGoalRow}
              onAddGoal={addGoalRow}
            />
            <div className="mt-10 flex flex-col gap-4 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[2.75rem] rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/20 transition hover:bg-emerald-500 hover:brightness-105 active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                >
                  {saving ? "Saving..." : "Save plan"}
                </button>
                {saveFeedback ? (
                  <span
                    className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/25"
                    role="status"
                  >
                    Saved
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-600">
                Updates apply to your overview and waterfall after you save.
              </p>
            </div>
          </div>
        </section>

        <GoalsPlanInsights
          firstGoalTimeline={firstSimT ?? null}
          firstGoalName={firstFilledGoal?.name.trim() ?? null}
          monthlySavings={effectiveSavingsSimMonthly}
          savePercentEffective={normalizedSavePct}
          aiPayload={aiStrategyPayload}
          proReady={proReady}
          isPro={isPro}
        />
      </form>
    </DashboardShell>
  );
}
