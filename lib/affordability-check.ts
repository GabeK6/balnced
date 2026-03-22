import type { CopilotOverviewContext } from "@/lib/copilot-types";

export type AffordabilityVerdict = "yes" | "no" | "risky";

export type AffordabilityComputation = {
  verdict: AffordabilityVerdict;
  amount: number;
  safeToSpend: number;
  remainingAfter: number;
  billsCommittedBeforePayday: number;
  monthlyToGoals: number;
  dailySpendingLimit: number;
  daysUntilPayday: number;
};

/**
 * Uses the same conceptual basis as Overview: compare a purchase to **safe to spend**
 * (wallet after bills + goal allocation for the period). Optional context fields are for copy only.
 *
 * - **no**: purchase exceeds safe-to-spend (or no room when safe is 0).
 * - **risky**: purchase fits but leaves a thin buffer vs daily runway / % of safe.
 * - **yes**: purchase fits with comfortable remaining buffer.
 */
export function computeAffordability(
  amount: number,
  ctx: CopilotOverviewContext
): AffordabilityComputation | null {
  if (!Number.isFinite(amount) || amount < 0) return null;

  const safe = Math.max(0, ctx.cashAndPayPeriod.safeToSpend);
  const daily = Math.max(0, ctx.cashAndPayPeriod.dailySpendingLimitUntilPayday);
  const days = Math.max(0, ctx.cashAndPayPeriod.daysUntilPayday);
  const bills = Math.max(0, ctx.bills.totalCommittedBeforePayday);
  const monthlyToGoals = Math.max(0, ctx.goals.monthlyToSavingsAndInvest);

  if (safe <= 0 && amount > 0) {
    return {
      verdict: "no",
      amount,
      safeToSpend: safe,
      remainingAfter: -amount,
      billsCommittedBeforePayday: bills,
      monthlyToGoals,
      dailySpendingLimit: daily,
      daysUntilPayday: days,
    };
  }

  if (amount > safe) {
    return {
      verdict: "no",
      amount,
      safeToSpend: safe,
      remainingAfter: safe - amount,
      billsCommittedBeforePayday: bills,
      monthlyToGoals,
      dailySpendingLimit: daily,
      daysUntilPayday: days,
    };
  }

  const remainingAfter = safe - amount;

  /** Tight buffer: less than ~2 days of “usual” daily room or < 22% of original safe (min $25 when safe is meaningful). */
  const runwayThreshold = Math.max(
    25,
    daily * 2,
    safe > 0 ? safe * 0.22 : 0
  );

  const verdict: AffordabilityVerdict =
    remainingAfter < runwayThreshold ? "risky" : "yes";

  return {
    verdict,
    amount,
    safeToSpend: safe,
    remainingAfter,
    billsCommittedBeforePayday: bills,
    monthlyToGoals,
    dailySpendingLimit: daily,
    daysUntilPayday: days,
  };
}

/** Fallback copy when AI is off or fails — one or two short sentences. */
export function templateAffordabilityExplanation(c: AffordabilityComputation): string {
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (c.verdict === "no") {
    if (c.safeToSpend <= 0) {
      return `No — safe-to-spend is ${fmt(0)} after bills and goals until payday.`;
    }
    return `No — ${fmt(c.amount)} is above your safe-to-spend (${fmt(c.safeToSpend)}); bills (${fmt(c.billsCommittedBeforePayday)}) and monthly goals (${fmt(c.monthlyToGoals)}) are already counted.`;
  }

  if (c.verdict === "risky") {
    return `Risky — it fits, but you’d only have ${fmt(c.remainingAfter)} left (${c.daysUntilPayday} day${c.daysUntilPayday === 1 ? "" : "s"} to payday), thin vs ${fmt(c.dailySpendingLimit)}/day.`;
  }

  return `Yes — you’d still have about ${fmt(c.remainingAfter)} left after this; comfortable buffer before payday.`;
}
