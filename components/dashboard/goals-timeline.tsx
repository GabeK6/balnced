"use client";

import type {
  SavingsGoalItem,
  SavingsGoalTimeline,
  SavingsGoalDraftPatch,
} from "@/lib/dashboard-data";
import { formatMoney, formatDateMonthYear } from "@/lib/dashboard-data";
import {
  effectiveGoalKind,
  GOAL_KIND_ORDER,
  GOAL_KIND_META,
  prefillForGoalKind,
  computeHouseDownAmount,
} from "@/lib/goal-purchase-helpers";
import { getGoalStatus } from "@/lib/financial-status";
import StatusBadge from "@/components/dashboard/status-badge";
import GoalDifficultyBadge from "@/components/dashboard/goal-difficulty-badge";
import { getGoalDifficulty } from "@/lib/goal-difficulty";

function pacePercent(amount: number, monthlySavings: number): number {
  if (amount <= 0 || monthlySavings <= 0) return 0;
  return Math.min(100, Math.round((monthlySavings / amount) * 100));
}

/** Vertical spacing between milestones from waterfall month duration (clamped for layout). */
function spacingFromMonths(months: number): number {
  if (!Number.isFinite(months) || months <= 0) return 20;
  return Math.min(132, Math.max(20, 8 + months * 5));
}

type Props = {
  sortedDrafts: SavingsGoalItem[];
  timelineById: Map<string, SavingsGoalTimeline>;
  monthlySavingsFromSave: number;
  monthlyTakeHome: number;
  updateDraft: (id: string, patch: SavingsGoalDraftPatch) => void;
  moveGoal: (id: string, dir: -1 | 1) => void;
  removeGoalRow: (id: string) => void;
  onAddGoal?: () => void;
};

export default function GoalsTimeline({
  sortedDrafts,
  timelineById,
  monthlySavingsFromSave,
  monthlyTakeHome,
  updateDraft,
  moveGoal,
  removeGoalRow,
  onAddGoal,
}: Props) {
  const firstFilledWithTimeline = sortedDrafts.find((g) => {
    const filled = g.name.trim().length > 0 && Number(g.amount) > 0;
    return filled && timelineById.has(g.id) && monthlySavingsFromSave > 0;
  });
  return (
    <div className="min-h-0 space-y-8">
      <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Your goals
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">
            Goal details
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Define types, targets, and timeline. Your top priority receives the full monthly savings rate
            until it’s complete.
          </p>
        </div>
        {onAddGoal ? (
          <button
            type="button"
            onClick={onAddGoal}
            className="shrink-0 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/[0.07] px-5 py-2.5 text-sm font-semibold text-emerald-200/95 transition hover:border-emerald-400/60 hover:bg-emerald-500/15"
          >
            + Add goal
          </button>
        ) : null}
      </div>

      <div className="relative">
        <div
          className="absolute bottom-6 left-[11px] top-10 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/25 to-transparent sm:left-[13px]"
          aria-hidden
        />

        <ol className="relative m-0 list-none space-y-0 p-0">
          {sortedDrafts.map((g, idx) => {
            const t = timelineById.get(g.id);
            const prev = idx > 0 ? timelineById.get(sortedDrafts[idx - 1].id) : null;
            const marginTop = idx === 0 ? 0 : spacingFromMonths(prev?.months ?? 0);
            const filled = g.name.trim().length > 0 && Number(g.amount) > 0;
            const goalStatus =
              t && monthlySavingsFromSave > 0
                ? getGoalStatus(true, t.amount, t.months, monthlySavingsFromSave)
                : null;
            const pace = t ? pacePercent(t.amount, monthlySavingsFromSave) : 0;
            const isNext =
              firstFilledWithTimeline != null && g.id === firstFilledWithTimeline.id;
            const difficultyLevel =
              t && monthlySavingsFromSave > 0
                ? getGoalDifficulty({
                    monthsToFund: t.months,
                    goalAmount: t.amount,
                    monthlyTakeHome,
                  })
                : null;
            const kind = effectiveGoalKind(g);
            const downPctQuick = [5, 10, 15, 20] as const;
            const emergencyMonthOptions = [3, 4, 5, 6, 9, 12] as const;

            return (
              <li key={g.id} className="relative pl-10 sm:pl-12" style={{ marginTop }}>
                <div
                  className={`absolute left-0 top-5 flex h-6 w-6 items-center justify-center rounded-full border-2 sm:top-6 sm:h-7 sm:w-7 ${
                    isNext && filled
                      ? "border-emerald-400 bg-emerald-500/30 shadow-[0_0_12px_-2px_rgba(52,211,153,0.45)]"
                      : "border-white/20 bg-slate-900/90"
                  }`}
                  aria-hidden
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isNext && filled ? "bg-emerald-300" : "bg-slate-500"
                    }`}
                  />
                </div>

                <div
                  className={`rounded-2xl border border-white/[0.08] bg-slate-900/35 p-6 shadow-sm transition duration-300 ease-out motion-reduce:transition-none hover:border-white/[0.14] sm:hover:-translate-y-0.5 sm:hover:shadow-md sm:hover:shadow-black/25 ${
                    isNext && filled ? "ring-1 ring-emerald-500/30" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-4">
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      {g.priority === 1 ? "Active goal" : `Goal ${g.priority}`}
                    </span>
                    {isNext && filled ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                        Next up
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveGoal(g.id, -1)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] active:scale-95 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === sortedDrafts.length - 1}
                        onClick={() => moveGoal(g.id, 1)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] active:scale-95 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGoalRow(g.id)}
                        className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/25 active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div
                    className={`mt-5 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-5 sm:p-6 ${
                      difficultyLevel === "easy"
                        ? "border-l-2 border-l-emerald-500/35"
                        : difficultyLevel === "moderate"
                          ? "border-l-2 border-l-amber-500/30"
                          : difficultyLevel === "aggressive"
                            ? "border-l-2 border-l-rose-500/35"
                            : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold tracking-tight text-slate-200">
                        Goal snapshot
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <GoalDifficultyBadge level={difficultyLevel} />
                        {goalStatus ? (
                          <StatusBadge status={goalStatus.status} label={goalStatus.label} />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Goal type
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {GOAL_KIND_ORDER.map((k) => {
                          const active = kind === k;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() =>
                                updateDraft(g.id, prefillForGoalKind(k, monthlyTakeHome))
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition duration-200 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                                active
                                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100 shadow-sm shadow-emerald-900/20"
                                  : "border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20 hover:bg-white/[0.06] hover:text-slate-200"
                              }`}
                            >
                              <span className="block leading-tight">
                                {GOAL_KIND_META[k].label}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                {GOAL_KIND_META[k].kicker}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {GOAL_KIND_META[kind].hint}
                      </p>
                    </div>

                    {kind === "house" ? (
                      <div className="mt-5 space-y-4 rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`house-price-${g.id}`}
                              className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                            >
                              Home price
                            </label>
                            <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 transition focus-within:border-emerald-500/30">
                              <span className="text-slate-500 tabular-nums" aria-hidden>
                                $
                              </span>
                              <input
                                id={`house-price-${g.id}`}
                                type="number"
                                min={0}
                                step={1000}
                                placeholder="e.g. 350000"
                                value={
                                  g.house_price != null && g.house_price > 0
                                    ? g.house_price
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const price = raw === "" ? 0 : Number(raw);
                                  const pct =
                                    g.down_payment_percent != null
                                      ? g.down_payment_percent
                                      : 20;
                                  updateDraft(g.id, {
                                    house_price: price,
                                    amount: computeHouseDownAmount(price, pct),
                                  });
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent pl-1 text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor={`down-pct-${g.id}`}
                              className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                            >
                              Down payment
                            </label>
                            <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 transition focus-within:border-emerald-500/30">
                              <input
                                id={`down-pct-${g.id}`}
                                type="number"
                                min={0}
                                max={100}
                                step={0.5}
                                placeholder="%"
                                value={
                                  g.down_payment_percent != null
                                    ? g.down_payment_percent
                                    : ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const pct = raw === "" ? 0 : Number(raw);
                                  const price = g.house_price ?? 0;
                                  updateDraft(g.id, {
                                    down_payment_percent: pct,
                                    amount: computeHouseDownAmount(price, pct),
                                  });
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                              />
                              <span className="shrink-0 text-slate-500" aria-hidden>
                                %
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {downPctQuick.map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => {
                                    const price = g.house_price ?? 0;
                                    updateDraft(g.id, {
                                      down_payment_percent: pct,
                                      amount: computeHouseDownAmount(price, pct),
                                    });
                                  }}
                                  className="rounded-md border border-white/10 bg-slate-900/40 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-200 active:scale-95"
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400">
                          <span className="text-slate-500">Down payment to save: </span>
                          <span className="text-lg font-bold tabular-nums text-white">
                            {formatMoney(g.amount)}
                          </span>
                          {g.house_price != null &&
                          g.house_price > 0 &&
                          g.down_payment_percent != null ? (
                            <span className="mt-1 block text-xs text-slate-500">
                              {g.down_payment_percent}% of {formatMoney(g.house_price)} home
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ) : null}

                    {kind === "car" ? (
                      <div className="mt-5 space-y-4 rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
                        <div>
                          <label
                            htmlFor={`car-price-${g.id}`}
                            className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                          >
                            Vehicle price (savings target)
                          </label>
                          <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 transition focus-within:border-emerald-500/30">
                            <span className="text-slate-500 tabular-nums" aria-hidden>
                              $
                            </span>
                            <input
                              id={`car-price-${g.id}`}
                              type="number"
                              min={0}
                              step={100}
                              placeholder="e.g. 28000"
                              value={g.amount === 0 ? "" : g.amount}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateDraft(g.id, {
                                  amount: raw === "" ? 0 : Number(raw),
                                });
                              }}
                              className="min-w-0 flex-1 border-0 bg-transparent pl-1 text-sm tabular-nums text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                            />
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor={`car-months-${g.id}`}
                            className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                          >
                            Target timeline
                          </label>
                          <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 transition focus-within:border-emerald-500/30">
                            <span className="text-sm text-slate-500">Buy in</span>
                            <input
                              id={`car-months-${g.id}`}
                              type="number"
                              min={1}
                              max={120}
                              step={1}
                              placeholder="36"
                              value={
                                g.car_target_months != null && g.car_target_months > 0
                                  ? g.car_target_months
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateDraft(g.id, {
                                  car_target_months:
                                    raw === "" ? undefined : Number(raw),
                                });
                              }}
                              className="w-20 border-0 bg-transparent text-sm tabular-nums text-slate-100 focus:outline-none focus:ring-0"
                            />
                            <span className="text-sm text-slate-500">months</span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            We’ll compare this to your projected funding time once save % is set.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {kind === "emergency_fund" ? (
                      <div className="mt-5 space-y-4 rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
                        <div>
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                            Months of take-home
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {emergencyMonthOptions.map((m) => {
                              const active =
                                (g.emergency_months ?? 6) === m && monthlyTakeHome > 0;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    const amount =
                                      monthlyTakeHome > 0
                                        ? Math.round(monthlyTakeHome * m)
                                        : Math.max(1500, m * 2500);
                                    updateDraft(g.id, {
                                      emergency_months: m,
                                      amount,
                                    });
                                  }}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100 ${
                                    active
                                      ? "border-emerald-500/45 bg-emerald-500/15 text-emerald-100"
                                      : "border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/20"
                                  }`}
                                >
                                  {m} mo
                                </button>
                              );
                            })}
                          </div>
                          {monthlyTakeHome <= 0 ? (
                            <p className="mt-2 text-xs text-amber-200/90">
                              Add income in your budget to auto-size this from take-home—or set the
                              dollar target below.
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">
                              Target ≈{" "}
                              <span className="font-semibold tabular-nums text-slate-300">
                                {formatMoney(g.amount)}
                              </span>{" "}
                              ({g.emergency_months ?? 6}× take-home)
                            </p>
                          )}
                        </div>
                        {monthlyTakeHome <= 0 ? (
                          <div>
                            <label
                              htmlFor={`ef-amt-${g.id}`}
                              className="block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                            >
                              Target balance
                            </label>
                            <div className="mt-1 flex items-center rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                              <span className="text-slate-500 tabular-nums" aria-hidden>
                                $
                              </span>
                              <input
                                id={`ef-amt-${g.id}`}
                                type="number"
                                min={0}
                                step={100}
                                value={g.amount === 0 ? "" : g.amount}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  updateDraft(g.id, {
                                    amount: raw === "" ? 0 : Number(raw),
                                  });
                                }}
                                className="min-w-0 flex-1 border-0 bg-transparent pl-1 text-sm tabular-nums text-slate-100 focus:outline-none focus:ring-0"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Goal info
                    </p>
                    <label
                      htmlFor={`goal-name-${g.id}`}
                      className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      {kind === "custom" ? "Goal name" : "Name (editable)"}
                    </label>
                    <input
                      id={`goal-name-${g.id}`}
                      type="text"
                      placeholder={
                        kind === "custom"
                          ? "Goal name"
                          : "Rename if you like"
                      }
                      value={g.name}
                      onChange={(e) => updateDraft(g.id, { name: e.target.value })}
                      className="mt-1 w-full border-0 bg-transparent p-0 text-xl font-semibold tracking-tight text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-0"
                    />

                    <div className="mt-5 flex flex-wrap items-end gap-4">
                      <div className="min-w-[8rem] flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {kind === "house"
                            ? "Down payment target"
                            : kind === "car"
                              ? "Vehicle price"
                              : kind === "emergency_fund"
                                ? "Target balance"
                                : "Target amount"}
                        </p>
                        {kind === "house" || (kind === "emergency_fund" && monthlyTakeHome > 0) ? (
                          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                            {formatMoney(g.amount)}
                          </p>
                        ) : (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-slate-500 tabular-nums" aria-hidden>
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
                                  amount:
                                    e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-2xl font-bold tabular-nums text-white placeholder:text-slate-600 focus:outline-none focus:ring-0"
                            />
                          </div>
                        )}
                      </div>

                      <div className="min-w-[10rem] flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Timeline · Est. completion
                        </p>
                        {t && monthlySavingsFromSave > 0 ? (
                          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300 sm:text-xl">
                            {formatDateMonthYear(t.targetDate)}
                          </p>
                        ) : filled ? (
                          <p className="mt-1 text-sm text-slate-500">
                            Set save % to estimate
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">—</p>
                        )}
                      </div>
                    </div>

                    {kind === "car" &&
                    filled &&
                    t &&
                    monthlySavingsFromSave > 0 &&
                    g.car_target_months != null &&
                    g.car_target_months > 0 ? (
                      <p
                        className={`mt-3 text-sm leading-snug ${
                          t.months <= g.car_target_months
                            ? "text-slate-400"
                            : "text-amber-200/90"
                        }`}
                      >
                        {t.months <= g.car_target_months
                          ? `At your pace you’d fund this in ~${t.months} mo—within your ${g.car_target_months}-month target.`
                          : `At your pace funding takes ~${t.months} mo—longer than your ${g.car_target_months}-month target. Try raising save % or extending the timeline.`}
                      </p>
                    ) : null}

                    {t && monthlySavingsFromSave > 0 ? (
                      <>
                        <p className="mt-2 text-xs text-slate-500">
                          {t.months} month{t.months !== 1 ? "s" : ""} of funding at your rate after
                          earlier priorities.
                        </p>

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>One month of saving covers</span>
                            <span className="tabular-nums font-medium text-slate-400">
                              ~{pace}% of this goal
                            </span>
                          </div>
                          <div
                            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5"
                            role="progressbar"
                            aria-valuenow={pace}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`About ${pace} percent of this goal from one month of saving`}
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-[width] duration-200 ease-out motion-reduce:transition-none"
                              style={{ width: `${pace}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : filled && monthlySavingsFromSave <= 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Add a save % in your plan summary to see dates and progress.
                      </p>
                    ) : !filled ? (
                      <p className="mt-3 text-sm text-slate-500">
                        Add a name and target amount for this goal.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
