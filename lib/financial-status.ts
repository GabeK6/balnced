/**
 * Shared financial status for Safe to Spend, Goals, and other app areas.
 * Data-driven: derived from real numbers, not decorative.
 */

export type FinancialStatus =
  | "on_track"
  | "tight"
  | "overspending"
  | "strong"
  | "behind"
  | "improving";

export type FinancialStatusResult = {
  status: FinancialStatus;
  label: string;
};

/**
 * Derive status from safe-to-spend and daily limit (runway = days of spending at current rate).
 * Used for Overview hero, Insights, and anywhere we show "how am I doing until payday?"
 */
export function getSafeToSpendStatus(
  safeToSpend: number,
  dailyLimit: number,
  daysUntilPayday: number
): FinancialStatusResult {
  if (safeToSpend <= 0) {
    return {
      status: dailyLimit <= 0 ? "overspending" : "tight",
      label: safeToSpend < 0 ? "Overspending" : "Tight until payday",
    };
  }

  const runwayDays =
    dailyLimit > 0 && daysUntilPayday > 0 ? safeToSpend / dailyLimit : 999;

  if (runwayDays < 3) {
    return { status: "tight", label: "Tight until payday" };
  }
  if (runwayDays < 7) {
    return { status: "improving", label: "Cautious" };
  }
  if (runwayDays < 14) {
    return { status: "on_track", label: "On track" };
  }
  return { status: "strong", label: "Strong cushion" };
}

/**
 * Derive goal status from goal amount, timeline months, and current monthly savings.
 * Behind = no save rate, or current save meaningfully below what's needed for this leg of the plan.
 *
 * We intentionally do **not** mark "Behind" only because the timeline is long (e.g. 20+ years).
 * Long horizons are common with small save % or waterfall goal #2+; the ratio of actual vs
 * required monthly savings is the right signal.
 */
export function getGoalStatus(
  hasGoal: boolean,
  goalAmount: number,
  monthsToTarget: number,
  currentMonthlySave: number
): FinancialStatusResult | null {
  if (!hasGoal || goalAmount <= 0) return null;
  const requiredMonthly = monthsToTarget > 0 ? goalAmount / monthsToTarget : 0;
  if (currentMonthlySave <= 0) {
    return { status: "behind", label: "Behind" };
  }
  if (requiredMonthly <= 0) return { status: "on_track", label: "On track" };
  const ratio = currentMonthlySave / requiredMonthly;
  if (ratio < 0.8) return { status: "behind", label: "Behind" };
  if (ratio >= 1.2) return { status: "strong", label: "Strong" };
  return { status: "on_track", label: "On track" };
}
