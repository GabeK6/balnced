"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SavingsGoalItem, SavingsGoalTimeline } from "@/lib/dashboard-data";
import { formatMoney } from "@/lib/dashboard-data";
import GoalDifficultyBadge from "@/components/dashboard/goal-difficulty-badge";
import { getGoalDifficulty } from "@/lib/goal-difficulty";

type FlowStep = {
  id: string;
  name: string;
  priority: number;
  months: number;
  amount: number;
};

type Props = {
  monthlySavings: number;
  monthlyTakeHome: number;
  sortedDrafts: SavingsGoalItem[];
  timelineById: Map<string, SavingsGoalTimeline>;
};

export default function SavingsFlowVisual({
  monthlySavings,
  monthlyTakeHome,
  sortedDrafts,
  timelineById,
}: Props) {
  const steps = useMemo(() => {
    const out: FlowStep[] = [];
    for (const g of sortedDrafts) {
      const filled = g.name.trim().length > 0 && Number(g.amount) > 0;
      const t = timelineById.get(g.id);
      if (!filled || !t) continue;
      out.push({
        id: g.id,
        name: g.name.trim(),
        priority: g.priority,
        months: t.months,
        amount: t.amount,
      });
    }
    return out;
  }, [sortedDrafts, timelineById]);

  const reduce = useReducedMotion();

  if (monthlySavings <= 0) {
    return (
      <section
        className="rounded-3xl border border-white/[0.08] bg-slate-900/40 p-6 sm:p-7 transition duration-300 hover:border-white/[0.12]"
        aria-labelledby="savings-flow-heading"
      >
        <h2
          id="savings-flow-heading"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500"
        >
          Savings flow
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          Set a <span className="text-slate-400">save %</span> in your plan summary to see how each
          dollar moves through your goals—always 100% to one goal at a time until it’s done.
        </p>
      </section>
    );
  }

  if (steps.length === 0) {
    return (
      <section
        className="rounded-3xl border border-white/[0.08] bg-slate-900/40 p-6 sm:p-7 transition duration-300 hover:border-white/[0.12]"
        aria-labelledby="savings-flow-heading"
      >
        <h2
          id="savings-flow-heading"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500"
        >
          Savings flow
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          Add goal names and amounts to see the waterfall:{" "}
          <span className="text-slate-400">
            {formatMoney(monthlySavings)}/mo
          </span>{" "}
          will fund them in priority order.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-3xl border border-emerald-500/25 bg-emerald-950/20 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-7 transition duration-300 ease-out hover:border-emerald-400/35 sm:hover:-translate-y-0.5 sm:hover:shadow-md sm:hover:shadow-black/15"
      aria-labelledby="savings-flow-heading"
    >
      <h2
        id="savings-flow-heading"
        className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/80"
      >
        Savings flow
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-slate-300">
        <span className="text-lg font-bold tabular-nums text-emerald-200 sm:text-xl">
          {formatMoney(Math.round(monthlySavings))}/mo
        </span>{" "}
        <span className="text-slate-500">→</span>{" "}
        {steps.map((s, i) => (
          <span key={s.id}>
            {i > 0 ? <span className="text-slate-500"> → </span> : null}
            <span className="font-medium text-slate-100">{s.name}</span>
          </span>
        ))}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Waterfall rule: the full monthly amount goes to the top priority until that goal is
        complete, then moves to the next—never split across goals in the same month.
      </p>

      <div className="mt-8 flex flex-col gap-0 divide-y divide-white/[0.06]">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1] : null;
          const isLast = i === steps.length - 1;
          const difficulty = getGoalDifficulty({
            monthsToFund: s.months,
            goalAmount: s.amount,
            monthlyTakeHome,
          });
          const isActive = i === 0;

          return (
            <div key={s.id} className="flex gap-3 pb-6 pt-6 first:pt-0 last:pb-0 sm:gap-4">
              <div
                className="flex w-7 shrink-0 flex-col items-center pt-1.5 sm:w-8"
                aria-hidden
              >
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ${
                    isActive
                      ? "bg-emerald-300 ring-emerald-400/50 shadow-[0_0_12px_-2px_rgba(52,211,153,0.5)]"
                      : "bg-emerald-400 ring-emerald-400/25"
                  }`}
                />
                {!isLast ? (
                  <div className="flex flex-col items-center py-1 text-emerald-500/70">
                    <span className="text-xs leading-none">↓</span>
                    <div className="mt-0.5 h-6 w-px bg-emerald-500/25 sm:h-7" />
                  </div>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <motion.div
                  className={`rounded-xl border bg-slate-900/50 px-3 py-3 sm:px-4 ${
                    isActive
                      ? "border-emerald-500/35 ring-1 ring-emerald-500/20" 
                      : "border-white/[0.08]"
                  } ${
                    difficulty === "easy"
                      ? "border-l-2 border-l-emerald-500/35"
                      : difficulty === "moderate"
                        ? "border-l-2 border-l-amber-500/30"
                        : difficulty === "aggressive"
                          ? "border-l-2 border-l-rose-500/35"
                          : ""
                  }`}
                  whileHover={
                    reduce
                      ? undefined
                      : { y: -2, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }
                  }
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{s.name}</span>
                      <GoalDifficultyBadge level={difficulty} />
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        #{s.priority}
                      </span>
                      {i === 0 ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                          Funded first
                        </span>
                      ) : prev ? (
                        <span className="rounded-full bg-slate-600/35 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          Starts after “{prev.name}”
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-100">
                      {formatMoney(s.amount)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {i === 0 ? (
                      <>
                        <span className="font-medium text-slate-400">100%</span> of{" "}
                        {formatMoney(Math.round(monthlySavings))}/mo here until this goal is funded
                        (~{s.months} mo remaining).
                      </>
                    ) : (
                      <>
                        After{" "}
                        <span className="font-medium text-slate-400">{prev?.name}</span>, the full{" "}
                        {formatMoney(Math.round(monthlySavings))}/mo shifts here until done (~{s.months}{" "}
                        mo remaining).
                      </>
                    )}
                  </p>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
