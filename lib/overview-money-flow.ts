import type { Budget, Expense, RecurringBill } from "@/lib/dashboard-data";
import { getMonthlyPay, loadUserGoals } from "@/lib/dashboard-data";
import { estimateMonthlyRecurringTotal } from "@/lib/recurring-bill-occurrences";
import { getThisMonthSpending } from "@/lib/expense-dashboard-summaries";

export type MoneyFlowSnapshot = {
  incomeMonthly: number;
  billsMonthly: number;
  savingsAllocatedMonthly: number;
  spendingThisMonth: number;
  remainingBalance: number;
};

/**
 * Monthly income → recurring bills → savings goals → this month’s spending → wallet remainder.
 * Uses the same primitives as Overview / Expenses (no new data sources).
 */
export function computeMoneyFlowSnapshot(
  budget: Budget | null,
  recurringBills: RecurringBill[],
  expenses: Expense[],
  userId: string | null,
  /** All-time expenses total subtracted from balance (same as Overview). */
  expensesTotalLogged: number,
  now: Date = new Date()
): MoneyFlowSnapshot | null {
  if (!budget) return null;

  const monthlyPay = getMonthlyPay(budget);
  const monthlyBills = estimateMonthlyRecurringTotal(recurringBills);
  const goals = userId ? loadUserGoals(userId) : null;
  const savePct = goals?.save_percent ?? 0;
  const investPct = goals?.invest_percent ?? 0;
  const savingsAllocatedMonthly =
    monthlyPay > 0 ? monthlyPay * ((savePct + investPct) / 100) : 0;
  const spendingThisMonth = getThisMonthSpending(expenses, now);
  const remainingBalance = Math.max(
    0,
    Number(budget.balance) - expensesTotalLogged
  );

  return {
    incomeMonthly: monthlyPay,
    billsMonthly: monthlyBills,
    savingsAllocatedMonthly,
    spendingThisMonth,
    remainingBalance,
  };
}

/**
 * Fractions for a stacked bar vs monthly income (capped so the bar stays readable).
 */
export function moneyFlowBarFractions(flow: MoneyFlowSnapshot): {
  bills: number;
  savings: number;
  spending: number;
  /** Leftover of monthly income after the three buckets (can be negative). */
  incomeRemainder: number;
} {
  const inc = Math.max(flow.incomeMonthly, 1);
  const bills = Math.min(1, flow.billsMonthly / inc);
  const savings = Math.min(1, flow.savingsAllocatedMonthly / inc);
  const spending = Math.min(1, flow.spendingThisMonth / inc);
  const incomeRemainder =
    flow.incomeMonthly - flow.billsMonthly - flow.savingsAllocatedMonthly - flow.spendingThisMonth;
  return { bills, savings, spending, incomeRemainder };
}
