/**
 * Single source of truth for cash / balance projection (Projection page, etc.).
 * Starting balance = budget.balance minus logged expenses (same as Overview current balance).
 */

import {
  getExpectedPaycheck,
  getNextPayday,
  getRecurringPaydays,
  toDateOnly,
  type Bill,
  type Budget,
  type Expense,
  type RecurringBill,
} from "@/lib/dashboard-data";
import {
  getDashboardBillsInClosedRange,
  BILL_OBLIGATION_LOOKBACK_DAYS,
} from "@/lib/recurring-bill-occurrences";

export type CashProjectionPoint = {
  date: string;
  title: string;
  change: number;
  balance: number;
};

/** Wallet balance after expenses you’ve already logged (matches Overview “current balance”). */
export function getWalletBalanceAfterExpenses(
  budget: Budget | null,
  expenses: Pick<Expense, "amount">[]
): number {
  if (!budget) return 0;
  const expensesTotal = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  return Number(budget.balance) - expensesTotal;
}

type ProjectionEvent = {
  date: string;
  /** 0 = bill (outflow first), 1 = payday */
  kind: 0 | 1;
  title: string;
  change: number;
};

export type CashProjectionResult = {
  points: CashProjectionPoint[];
  /** Balance just before the next paycheck lands (after bills due on/before that date). */
  balanceBeforeNextPayday: number;
  /** balanceBeforeNextPayday + one expected paycheck (only the next check, not multiple). */
  balanceAfterNextPayday: number;
  nextPayday: string | null;
  expectedPaycheck: number;
  sumBillsBeforeNextPayday: number;
  /** Bills due on/before next payday — same basis as balanceBeforeNextPayday. */
  billLinesBeforeNextPaydayCount: number;
};

/**
 * Builds timeline/chart points and summary figures from one starting balance.
 * Includes optional multi-payday horizon for chart/timeline only; summary always uses the first payday only.
 */
export function buildCashProjection(args: {
  budget: Budget | null;
  bills: Bill[];
  recurringBills: RecurringBill[];
  expenses: Pick<Expense, "amount">[];
  /** How many future paydays to plot (including the next one). */
  horizonPaychecks?: number;
  now?: Date;
}): CashProjectionResult {
  const now = args.now ?? new Date();
  const horizonPaychecks = args.horizonPaychecks ?? 4;
  const budget = args.budget;

  const empty: CashProjectionResult = {
    points: [],
    balanceBeforeNextPayday: 0,
    balanceAfterNextPayday: 0,
    nextPayday: null,
    expectedPaycheck: 0,
    sumBillsBeforeNextPayday: 0,
    billLinesBeforeNextPaydayCount: 0,
  };

  if (!budget) return empty;

  const nextPayday = getNextPayday(budget);
  const expectedPaycheck = getExpectedPaycheck(budget);
  const currentBalance = getWalletBalanceAfterExpenses(budget, args.expenses);

  const today0 = new Date(now);
  today0.setHours(0, 0, 0, 0);
  const todayStr = toDateOnly(today0);

  if (!nextPayday) {
    return {
      points: [
        {
          date: todayStr,
          title: "Today",
          change: 0,
          balance: currentBalance,
        },
      ],
      balanceBeforeNextPayday: currentBalance,
      balanceAfterNextPayday: currentBalance,
      nextPayday: null,
      expectedPaycheck,
      sumBillsBeforeNextPayday: 0,
      billLinesBeforeNextPaydayCount: 0,
    };
  }

  const paydays = getRecurringPaydays(
    nextPayday,
    budget.pay_frequency ?? null,
    Math.max(1, horizonPaychecks)
  );

  if (paydays.length === 0) {
    return {
      points: [
        { date: todayStr, title: "Today", change: 0, balance: currentBalance },
      ],
      balanceBeforeNextPayday: currentBalance,
      balanceAfterNextPayday: currentBalance + expectedPaycheck,
      nextPayday,
      expectedPaycheck,
      sumBillsBeforeNextPayday: 0,
      billLinesBeforeNextPaydayCount: 0,
    };
  }

  const firstPaydayStr = paydays[0];
  const lastPaydayDate = new Date(paydays[paydays.length - 1]);
  lastPaydayDate.setHours(0, 0, 0, 0);

  const rangeStart = new Date(today0);
  rangeStart.setDate(rangeStart.getDate() - BILL_OBLIGATION_LOOKBACK_DAYS);

  const billLinesInHorizon = getDashboardBillsInClosedRange(
    args.recurringBills,
    args.bills,
    rangeStart,
    lastPaydayDate
  );

  const billsBeforeNext = billLinesInHorizon.filter(
    (b) => b.due_date <= firstPaydayStr
  );
  const sumBillsBeforeNextPayday = billsBeforeNext.reduce(
    (s, b) => s + b.amount,
    0
  );

  const balanceBeforeNextPayday = currentBalance - sumBillsBeforeNextPayday;
  const balanceAfterNextPayday = balanceBeforeNextPayday + expectedPaycheck;

  const events: ProjectionEvent[] = [];

  const horizonOverdue = billLinesInHorizon.filter((b) => b.due_date < todayStr);
  const horizonRest = billLinesInHorizon.filter((b) => b.due_date >= todayStr);

  if (horizonOverdue.length > 0) {
    const sumOverdue = horizonOverdue.reduce((s, b) => s + b.amount, 0);
    events.push({
      date: todayStr,
      kind: 0,
      title:
        horizonOverdue.length === 1
          ? horizonOverdue[0].name
          : `Overdue bills (${horizonOverdue.length})`,
      change: -sumOverdue,
    });
  }

  for (const line of horizonRest) {
    events.push({
      date: line.due_date,
      kind: 0,
      title: line.name,
      change: -line.amount,
    });
  }

  for (const pd of paydays) {
    events.push({
      date: pd,
      kind: 1,
      title: "Payday",
      change: expectedPaycheck,
    });
  }

  events.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    if (a.kind !== b.kind) return a.kind - b.kind;
    return a.title.localeCompare(b.title);
  });

  const points: CashProjectionPoint[] = [
    { date: todayStr, title: "Today", change: 0, balance: currentBalance },
  ];

  let balance = currentBalance;
  for (const ev of events) {
    balance += ev.change;
    points.push({
      date: ev.date,
      title: ev.title,
      change: ev.change,
      balance,
    });
  }

  return {
    points,
    balanceBeforeNextPayday,
    balanceAfterNextPayday,
    nextPayday,
    expectedPaycheck,
    sumBillsBeforeNextPayday,
    billLinesBeforeNextPaydayCount: billsBeforeNext.length,
  };
}