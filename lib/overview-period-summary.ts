import type { Budget, Bill, Expense, RecurringBill } from "@/lib/dashboard-data";
import {
  getDaysUntil,
  getExpectedPaycheck,
  getMonthlyPay,
  getNextPayday,
  loadUserGoals,
} from "@/lib/dashboard-data";
import { getSafeToSpendStatus } from "@/lib/financial-status";
import { getDashboardBillsBeforePayday } from "@/lib/recurring-bill-occurrences";

export type OverviewPeriodSummary = {
  /** One expected paycheck — matches “this pay period” framing. */
  incomeThisPeriod: number;
  /** Bills due before next payday (committed cash). */
  billsCommitted: number;
  /** Save + invest slice from monthly take-home (same as safe-to-spend math). */
  savingsAllocated: number;
  /** Wallet balance after all logged expenses. */
  remainingBalance: number;
  /** Post-commitment safe amount (for cross-check; hero uses same pipeline). */
  safeToSpend: number;
  summarySentence: string;
  sentenceVariant: "on_track" | "tight" | "overspending";
};

/**
 * Single “command center” snapshot: income, bills, savings, balance + one-line verdict.
 * Uses the same safe-to-spend pipeline as the Overview hero (no extra fetches).
 */
export function computeOverviewPeriodSummary(
  budget: Budget | null,
  bills: Bill[],
  recurringBills: RecurringBill[],
  expenses: Expense[],
  userId: string | null,
  now: Date = new Date()
): OverviewPeriodSummary | null {
  if (!budget) return null;

  const expensesTotal = expenses.reduce(
    (s, e) => s + Math.max(0, Number(e.amount) || 0),
    0
  );
  const currentBalance = Number(budget.balance) - expensesTotal;

  const nextPayday = getNextPayday(budget);
  const paydayForBills = nextPayday ?? budget.next_payday ?? null;
  const upcomingBills = getDashboardBillsBeforePayday(
    recurringBills,
    bills,
    paydayForBills,
    now
  );
  const billsCommitted = upcomingBills.reduce(
    (s, b) => s + Math.max(0, Number(b.amount) || 0),
    0
  );

  const monthlyPay = getMonthlyPay(budget);
  const goalsData = userId ? loadUserGoals(userId) : null;
  const savePct = goalsData?.save_percent ?? 0;
  const investPct = goalsData?.invest_percent ?? 0;
  const savingsAllocated =
    monthlyPay > 0 ? monthlyPay * ((savePct + investPct) / 100) : 0;

  const safeToSpend = Math.max(
    0,
    currentBalance - billsCommitted - savingsAllocated
  );

  const daysUntilPayday = nextPayday ? getDaysUntil(nextPayday) : 0;
  const dailyLimit =
    daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;
  const sts = getSafeToSpendStatus(safeToSpend, dailyLimit, daysUntilPayday);

  let sentenceVariant: OverviewPeriodSummary["sentenceVariant"];
  let summarySentence: string;

  if (sts.status === "overspending") {
    sentenceVariant = "overspending";
    summarySentence = "You are overspending this period.";
  } else if (sts.status === "tight" || sts.status === "improving") {
    sentenceVariant = "tight";
    summarySentence =
      "You're tight on room this period — prioritize essentials until payday.";
  } else {
    sentenceVariant = "on_track";
    summarySentence = "You are on track this period.";
  }

  return {
    incomeThisPeriod: getExpectedPaycheck(budget),
    billsCommitted,
    savingsAllocated,
    remainingBalance: currentBalance,
    safeToSpend,
    summarySentence,
    sentenceVariant,
  };
}
