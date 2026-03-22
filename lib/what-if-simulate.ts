import type { CopilotOverviewContext } from "@/lib/copilot-types";
import type { UserGoals } from "@/lib/dashboard-data";
import { getSavingsGoalTimelines } from "@/lib/dashboard-data";
import type { RetirementProfile } from "@/lib/retirement-projection";
import { runProjection } from "@/lib/retirement-projection";
import type { InvestedAccountConfig, RetirementAccountType } from "@/lib/retirement-accounts";

export type WhatIfScenario =
  | { kind: "one_time_spend"; amount: number }
  | { kind: "monthly_extra_to_goals"; amount: number }
  | { kind: "monthly_extra_to_invest"; amount: number };

export type WhatIfGoalSnapshot = {
  name: string;
  targetDateISO: string;
  months: number;
} | null;

export type WhatIfSimulationResult = {
  scenario: WhatIfScenario;
  /** Not persisted — display only */
  baseline: {
    safeToSpend: number;
    dailyLimit: number;
    firstGoal: WhatIfGoalSnapshot;
    projectedRetirementUsd: number | null;
  };
  simulated: {
    safeToSpend: number;
    dailyLimit: number;
    firstGoal: WhatIfGoalSnapshot;
    projectedRetirementUsd: number | null;
  };
  /** Structured deltas for AI / UI */
  deltas: {
    safeToSpend: number;
    dailyLimit: number;
    firstGoalMonthsDelta: number | null;
    retirementUsdDelta: number | null;
  };
};

export function contextToUserGoals(ctx: CopilotOverviewContext): UserGoals | null {
  const list = ctx.goals.savingsGoals;
  if (!list.length) return null;
  return {
    retirement_age: ctx.goals.targetRetirementAge ?? 65,
    save_percent: ctx.goals.savePercent,
    invest_percent: ctx.goals.investPercent,
    savings_goals: list.map((g, i) => ({
      id: `copilot-${i}`,
      name: g.name,
      amount: g.targetAmount,
      priority: g.priority,
    })),
  };
}

/** Matches Overview: monthly pay × save % (waterfall to goals). */
export function baselineMonthlySavingsForGoals(ctx: CopilotOverviewContext): number {
  return Math.max(0, ctx.income.monthlyTakeHome * (ctx.goals.savePercent / 100));
}

function timelineFirst(rows: ReturnType<typeof getSavingsGoalTimelines>): WhatIfGoalSnapshot {
  const r = rows[0];
  if (!r) return null;
  return {
    name: r.name,
    targetDateISO: r.targetDate.toISOString(),
    months: r.months,
  };
}

/**
 * Applies a temporary scenario using the same goal waterfall as {@link getSavingsGoalTimelines}.
 * Retirement USD for `monthly_extra_to_invest` must be supplied via `retirementSimulatedUsd` from {@link runProjection}.
 */
export function computeWhatIfSimulation(
  ctx: CopilotOverviewContext,
  scenario: WhatIfScenario,
  opts?: {
    /** When set, overrides context retirement for simulated invest scenario */
    retirementSimulatedUsd?: number | null;
  }
): WhatIfSimulationResult {
  const safe = ctx.cashAndPayPeriod.safeToSpend;
  const days = Math.max(0, ctx.cashAndPayPeriod.daysUntilPayday);
  const daily = ctx.cashAndPayPeriod.dailySpendingLimitUntilPayday;
  const baseRet = ctx.retirement.projectedPortfolioAtRetirementUsd;

  const goals = contextToUserGoals(ctx);
  const baseMonthly = baselineMonthlySavingsForGoals(ctx);

  let baselineFirst: WhatIfGoalSnapshot = null;
  let simulatedFirst: WhatIfGoalSnapshot = null;
  if (goals && baseMonthly > 0) {
    const b = getSavingsGoalTimelines(null, goals, baseMonthly);
    baselineFirst = timelineFirst(b);
  }

  let simSafe = safe;
  let simDaily = daily;
  let simRet = baseRet;

  if (scenario.kind === "one_time_spend") {
    simSafe = Math.max(0, safe - scenario.amount);
    simDaily = days > 0 ? simSafe / days : simSafe;
    simulatedFirst = baselineFirst;
  } else if (scenario.kind === "monthly_extra_to_goals") {
    simSafe = safe;
    simDaily = daily;
    const newMonthly = baseMonthly + scenario.amount;
    if (goals && newMonthly > 0) {
      const s = getSavingsGoalTimelines(null, goals, newMonthly);
      simulatedFirst = timelineFirst(s);
    } else {
      simulatedFirst = baselineFirst;
    }
  } else {
    // monthly_extra_to_invest — safe/daily unchanged; goals timeline unchanged; retirement from opts
    simSafe = safe;
    simDaily = daily;
    simulatedFirst = baselineFirst;
    simRet =
      opts?.retirementSimulatedUsd !== undefined
        ? opts.retirementSimulatedUsd
        : baseRet;
  }

  const baselineFirstGoalMonths = baselineFirst?.months ?? null;
  const simulatedFirstGoalMonths = simulatedFirst?.months ?? null;
  const firstGoalMonthsDelta =
    baselineFirstGoalMonths != null && simulatedFirstGoalMonths != null
      ? simulatedFirstGoalMonths - baselineFirstGoalMonths
      : null;

  const retirementUsdDelta =
    baseRet != null && simRet != null ? simRet - baseRet : baseRet == null && simRet != null ? simRet : null;

  return {
    scenario,
    baseline: {
      safeToSpend: safe,
      dailyLimit: daily,
      firstGoal: baselineFirst,
      projectedRetirementUsd: baseRet,
    },
    simulated: {
      safeToSpend: simSafe,
      dailyLimit: simDaily,
      firstGoal: simulatedFirst,
      projectedRetirementUsd: simRet,
    },
    deltas: {
      safeToSpend: simSafe - safe,
      dailyLimit: simDaily - daily,
      firstGoalMonthsDelta,
      retirementUsdDelta,
    },
  };
}

/** Adds extra monthly employee contributions to the first invested account (annual += 12 × monthly). */
export function applyExtraMonthlyInvestToProfile(
  profile: RetirementProfile,
  monthlyExtra: number
): RetirementProfile {
  const deltaAnnual = Math.max(0, monthlyExtra) * 12;
  if (deltaAnnual <= 0) return profile;

  const copy: RetirementProfile = JSON.parse(JSON.stringify(profile));
  const accounts = copy.accounts ?? {};
  const order: RetirementAccountType[] = [
    "trad_401k",
    "roth_401k",
    "403b",
    "457b",
    "trad_ira",
    "roth_ira",
    "sep_ira",
    "simple_ira",
    "solo_401k",
    "taxable_brokerage",
  ];

  for (const type of order) {
    const raw = accounts[type];
    if (!raw || typeof raw !== "object" || "monthly_income" in raw) continue;
    const cfg = raw as InvestedAccountConfig;
    cfg.annual_contribution = Math.max(0, (cfg.annual_contribution ?? 0) + deltaAnnual);
    break;
  }

  return copy;
}

export function projectPortfolioForProfile(profile: RetirementProfile): number | null {
  const p = runProjection(profile);
  return p?.total_portfolio ?? null;
}
