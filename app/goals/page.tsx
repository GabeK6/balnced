"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  loadUserGoals,
  saveUserGoals,
  getSavingsGoalTimelines,
  getMonthlyPay,
  formatMoney,
  formatDateMonthYear,
  getEffectiveSavingsGoals,
  withSyncedLegacyBigPurchase,
  type UserGoals,
  type SavingsGoalItem,
  type Budget,
} from "@/lib/dashboard-data";
import { getGoalStatus } from "@/lib/financial-status";
import StatusBadge from "@/components/dashboard/status-badge";

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

  const updateDraft = (id: string, patch: Partial<Pick<SavingsGoalItem, "name" | "amount">>) => {
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

  const timelines = getSavingsGoalTimelines(budget, previewGoals, monthlySavingsFromSave);
  const timelineById = useMemo(
    () => new Map(timelines.map((t) => [t.id, t] as const)),
    [timelines]
  );
  const sortedDrafts = sortAndRenumberDrafts(goalDrafts);

  if (loading) {
    return (
      <DashboardShell
        title="Goals"
        subtitle="Loading..."
        backHref="/dashboard"
        backLabel="Back to Overview"
        compact
      >
        <div className="balnced-panel rounded-3xl p-6 sm:p-7">
          <p className="text-slate-400">Loading your goals...</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Goals"
      subtitle="Multiple savings targets with priorities. #1 is funded first, then #2, and so on."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <form
        onSubmit={handleSaveGoals}
        className="grid h-full min-h-0 gap-5 lg:grid-cols-[minmax(0,340px)_1fr]"
      >
        <div className="flex min-h-0 flex-col gap-4">
          <div className="balnced-panel rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-100">Goals setup</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Add goals here; edit names, amounts, and order on the right. Save when you’re done.
            </p>
            <button
              type="button"
              onClick={addGoalRow}
              className="mt-4 w-full rounded-xl border border-dashed border-slate-600 py-2.5 text-sm font-medium text-slate-400 transition hover:border-emerald-500/40 hover:text-emerald-400"
            >
              + Add another goal
            </button>
          </div>

          <div className="balnced-panel rounded-2xl p-5 sm:p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Savings plan
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Save % drives monthly funding and target dates on the right.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-1">
              <div>
                <label className="block text-xs font-medium text-slate-400">
                  Save % of income
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="e.g. 15"
                  value={savePercentInput}
                  onChange={(e) => setSavePercentInput(e.target.value)}
                  className="balnced-input mt-0.5"
                />
              </div>
              <div className="balnced-row rounded-xl p-4 text-sm text-slate-300">
                <p className="text-xs text-slate-500">Monthly savings</p>
                <p className="mt-2 text-base font-bold tabular-nums text-slate-100 sm:text-lg">
                  {formatMoney(monthlySavingsFromSave)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Waterfall: #1 is funded first, then #2, etc.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[2.75rem] flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save goals"}
            </button>
            {saveFeedback && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Saved!
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-auto">
          {sortedDrafts.map((g, idx) => {
            const t = timelineById.get(g.id);
            const filled = g.name.trim().length > 0 && Number(g.amount) > 0;
            const goalStatus =
              t && monthlySavingsFromSave > 0
                ? getGoalStatus(true, t.amount, t.months, monthlySavingsFromSave)
                : null;

            return (
              <div key={g.id} className="balnced-panel rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Priority {g.priority}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveGoal(g.id, -1)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 disabled:opacity-30 hover:bg-white/[0.05]"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedDrafts.length - 1}
                      onClick={() => moveGoal(g.id, 1)}
                      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 disabled:opacity-30 hover:bg-white/[0.05]"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoalRow(g.id)}
                      className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/25"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-900/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Preview
                    </p>
                    {goalStatus ? (
                      <StatusBadge status={goalStatus.status} label={goalStatus.label} />
                    ) : null}
                  </div>
                  <input
                    type="text"
                    placeholder="Goal name"
                    value={g.name}
                    onChange={(e) => updateDraft(g.id, { name: e.target.value })}
                    className="mt-2 w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-slate-500 tabular-nums" aria-hidden>
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={g.amount === 0 ? "" : String(g.amount)}
                      onChange={(e) =>
                        updateDraft(g.id, {
                          amount: e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm tabular-nums text-slate-400 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                    />
                  </div>

                  {t && monthlySavingsFromSave > 0 ? (
                    <>
                      <p className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        ~{formatDateMonthYear(t.targetDate)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {t.months} month{t.months !== 1 ? "s" : ""} of savings at your rate after
                        earlier priorities.
                      </p>
                    </>
                  ) : filled ? (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-slate-400">Estimated target month</p>
                      <p className="mt-0.5 text-base text-slate-500">
                        Set <span className="text-slate-300">save %</span> on the left (&gt; 0) to see
                        a month.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Add a name and amount to see details.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </DashboardShell>
  );
}
