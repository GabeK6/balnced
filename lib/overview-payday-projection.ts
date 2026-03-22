import type { Expense } from "@/lib/dashboard-data";
import { dailyAverageThisMonth } from "@/lib/expense-dashboard-summaries";

export type PaydayBalanceProjection = {
  /** Wallet balance if this month’s daily spend pace continues until payday. */
  projectedBalanceAtPayday: number;
  /** Average $ logged per calendar day this month (month-to-date ÷ day of month). */
  dailySpendPace: number;
  daysUntilPayday: number;
};

/**
 * Simple forward look: `currentBalance − (dailySpendPace × daysUntilPayday)`.
 * Pace = this month’s spending so far ÷ day of month (same as Expenses “daily average”).
 */
export function computePaydayBalanceProjection(
  currentBalance: number,
  expenses: Expense[],
  daysUntilPayday: number,
  now: Date = new Date()
): PaydayBalanceProjection {
  const dailySpendPace = dailyAverageThisMonth(expenses, now);
  const n = Math.max(0, daysUntilPayday);
  const projectedBalanceAtPayday = currentBalance - dailySpendPace * n;

  return {
    projectedBalanceAtPayday,
    dailySpendPace,
    daysUntilPayday: n,
  };
}
