import type { Budget, Bill, Expense, RecurringBill } from "@/lib/dashboard-data";
import {
  addDays,
  getDaysUntil,
  getMonthlyPay,
  getNextPayday,
  loadUserGoals,
} from "@/lib/dashboard-data";
import { getSafeToSpendStatus } from "@/lib/financial-status";
import {
  estimateMonthlyRecurringTotal,
  getDashboardBillsBeforePayday,
} from "@/lib/recurring-bill-occurrences";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function expenseInRange(e: Expense, start: Date, end: Date): boolean {
  const t = new Date(e.created_at).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function sumExpenseAmounts(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
}

export function sumExpensesInRange(
  expenses: Expense[],
  start: Date,
  end: Date
): number {
  return expenses
    .filter((e) => expenseInRange(e, start, end))
    .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);
}

export function getThisMonthSpending(expenses: Expense[], now: Date = new Date()): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  return expenses.reduce((s, e) => {
    const d = new Date(e.created_at);
    if (d.getFullYear() !== y || d.getMonth() !== m) return s;
    return s + Math.max(0, Number(e.amount) || 0);
  }, 0);
}

export function getThisMonthCategoryTotals(
  expenses: Expense[],
  now: Date = new Date()
): Record<string, number> {
  const y = now.getFullYear();
  const m = now.getMonth();
  return expenses.reduce(
    (acc, e) => {
      const d = new Date(e.created_at);
      if (d.getFullYear() !== y || d.getMonth() !== m) return acc;
      const key = e.category?.trim() || "Other";
      acc[key] = (acc[key] || 0) + Math.max(0, Number(e.amount) || 0);
      return acc;
    },
    {} as Record<string, number>
  );
}

export function largestCategoryThisMonth(
  expenses: Expense[],
  now: Date = new Date()
): { name: string; amount: number } | null {
  const totals = getThisMonthCategoryTotals(expenses, now);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return { name: entries[0][0], amount: entries[0][1] };
}

/** Average spent per calendar day so far this month (total ÷ day of month). */
export function dailyAverageThisMonth(expenses: Expense[], now: Date = new Date()): number {
  const total = getThisMonthSpending(expenses, now);
  const dayOfMonth = now.getDate();
  return dayOfMonth > 0 ? total / dayOfMonth : 0;
}

/** Last 7 local calendar days including today. */
export function rollingSevenDaySpend(expenses: Expense[], now: Date = new Date()): number {
  const today = startOfDay(now);
  const rollStart = addDays(today, -6);
  return sumExpensesInRange(expenses, rollStart, endOfDay(now));
}

/** The 7 local days before the rolling window (days 8–14 ago). */
export function priorSevenDaySpend(expenses: Expense[], now: Date = new Date()): number {
  const today = startOfDay(now);
  const priorEnd = endOfDay(addDays(today, -7));
  const priorStart = startOfDay(addDays(today, -13));
  return sumExpensesInRange(expenses, priorStart, priorEnd);
}

export type WeekOverWeekTrend = {
  thisWeek: number;
  lastWeek: number;
  pctChange: number | null;
  direction: "up" | "down" | "same" | "none";
};

/** Rolling 7-day window vs the prior 7 days; used by Expenses weekly trend UI. */
export function weekOverWeekTrend(
  expenses: Expense[],
  now: Date = new Date()
): WeekOverWeekTrend {
  const thisWeek = rollingSevenDaySpend(expenses, now);
  const lastWeek = priorSevenDaySpend(expenses, now);
  if (lastWeek <= 0 && thisWeek <= 0) {
    return { thisWeek, lastWeek, pctChange: null, direction: "none" };
  }
  if (lastWeek <= 0) {
    return {
      thisWeek,
      lastWeek,
      pctChange: null,
      direction: thisWeek > 0 ? "up" : "none",
    };
  }
  const raw = ((thisWeek - lastWeek) / lastWeek) * 100;
  const pctChange = Math.round(raw * 10) / 10;
  const direction: WeekOverWeekTrend["direction"] =
    Math.abs(raw) < 1 ? "same" : raw > 0 ? "up" : "down";
  return { thisWeek, lastWeek, pctChange, direction };
}

/**
 * Same safe-to-spend remainder as Overview: balance after expenses, minus upcoming bills and goal slices.
 */
export function computeRemainingSafeToSpend(
  budget: Budget | null,
  bills: Bill[],
  recurringBills: RecurringBill[],
  expenses: Expense[],
  userId: string | null,
  now: Date = new Date()
): { value: number; canCompute: boolean } {
  if (!budget) return { value: 0, canCompute: false };
  const expensesTotal = sumExpenseAmounts(expenses);
  const currentBalance = Number(budget.balance) - expensesTotal;
  const nextPayday = getNextPayday(budget);
  const paydayForBills = nextPayday ?? budget.next_payday ?? null;
  const upcomingBills = getDashboardBillsBeforePayday(
    recurringBills,
    bills,
    paydayForBills,
    now
  );
  const billsTotal = upcomingBills.reduce((s, b) => s + Number(b.amount), 0);
  const monthlyPay = getMonthlyPay(budget);
  const goalsData = userId ? loadUserGoals(userId) : null;
  const savePct = goalsData?.save_percent ?? 0;
  const investPct = goalsData?.invest_percent ?? 0;
  const goalsToSubtract = monthlyPay > 0 ? monthlyPay * ((savePct + investPct) / 100) : 0;
  const safeToSpend = Math.max(0, currentBalance - billsTotal - goalsToSubtract);
  return { value: safeToSpend, canCompute: true };
}

/**
 * Monthly “room” = take-home − estimated recurring bills − save/invest slice − this month’s logged expenses.
 * Runway = same wallet-based safe-to-spend as Overview (until payday).
 */
export type ExpensesSafeGuidance = {
  canCompute: boolean;
  monthlyTakeHome: number;
  monthlyBills: number;
  monthlyGoals: number;
  spentThisMonth: number;
  /** Can be negative if spending exceeds the simple monthly plan. */
  monthlyHeadroom: number;
  runwaySafe: number;
  dailyLimit: number;
  daysUntilPayday: number;
  band: "safe" | "moderate" | "risk";
  runwayStatusLabel: string;
};

export function computeExpensesSafeGuidance(
  budget: Budget | null,
  bills: Bill[],
  recurringBills: RecurringBill[],
  expenses: Expense[],
  userId: string | null,
  now: Date = new Date()
): ExpensesSafeGuidance {
  const empty: ExpensesSafeGuidance = {
    canCompute: false,
    monthlyTakeHome: 0,
    monthlyBills: 0,
    monthlyGoals: 0,
    spentThisMonth: 0,
    monthlyHeadroom: 0,
    runwaySafe: 0,
    dailyLimit: 0,
    daysUntilPayday: 0,
    band: "risk",
    runwayStatusLabel: "",
  };

  if (!budget) return empty;

  const monthlyPay = getMonthlyPay(budget);
  const monthlyBills = estimateMonthlyRecurringTotal(recurringBills);
  const goalsData = userId ? loadUserGoals(userId) : null;
  const savePct = goalsData?.save_percent ?? 0;
  const investPct = goalsData?.invest_percent ?? 0;
  const monthlyGoals = monthlyPay > 0 ? monthlyPay * ((savePct + investPct) / 100) : 0;
  const spentThisMonth = getThisMonthSpending(expenses, now);
  const monthlyHeadroom = monthlyPay - monthlyBills - monthlyGoals - spentThisMonth;

  const runway = computeRemainingSafeToSpend(
    budget,
    bills,
    recurringBills,
    expenses,
    userId,
    now
  );
  const runwaySafe = runway.value;

  const nextPayday = getNextPayday(budget);
  const daysUntilPayday = nextPayday ? getDaysUntil(nextPayday) : 0;
  const dailyLimit =
    daysUntilPayday > 0 ? runwaySafe / daysUntilPayday : runwaySafe;

  const sts = getSafeToSpendStatus(runwaySafe, dailyLimit, daysUntilPayday);

  let band: ExpensesSafeGuidance["band"];
  if (runwaySafe <= 0 || monthlyHeadroom <= 0) {
    band = "risk";
  } else if (
    sts.status === "tight" ||
    sts.status === "overspending" ||
    (monthlyPay > 0 && monthlyHeadroom < monthlyPay * 0.05)
  ) {
    band = "moderate";
  } else {
    band = "safe";
  }

  return {
    canCompute: true,
    monthlyTakeHome: monthlyPay,
    monthlyBills,
    monthlyGoals,
    spentThisMonth,
    monthlyHeadroom,
    runwaySafe,
    dailyLimit,
    daysUntilPayday,
    band,
    runwayStatusLabel: sts.label,
  };
}

/**
 * Snapshot for UI right after logging an expense (derive from guidance with updated expense list).
 * “Budget” = monthly take-home minus recurring bills and save/invest slice; % = this month’s spending / that.
 */
export type PostExpenseFeedback = {
  hasMetrics: boolean;
  leftThisMonth: number;
  pctUsed: number | null;
  monthlyDisposable: number;
  runwayLeft: number;
  warning: "none" | "close" | "over";
};

export function computePostExpenseFeedback(
  guidance: ExpensesSafeGuidance
): PostExpenseFeedback {
  if (!guidance.canCompute) {
    return {
      hasMetrics: false,
      leftThisMonth: 0,
      pctUsed: null,
      monthlyDisposable: 0,
      runwayLeft: 0,
      warning: "none",
    };
  }

  const monthlyDisposable = Math.max(
    0,
    guidance.monthlyTakeHome - guidance.monthlyBills - guidance.monthlyGoals
  );
  const spent = guidance.spentThisMonth;
  const pctUsed =
    monthlyDisposable > 0
      ? Math.round((spent / monthlyDisposable) * 100)
      : spent > 0
        ? 100
        : null;

  const leftThisMonth = guidance.monthlyHeadroom;
  const runwayLeft = guidance.runwaySafe;

  let warning: PostExpenseFeedback["warning"] = "none";
  if (leftThisMonth < 0 || runwayLeft <= 0) {
    warning = "over";
  } else if (
    (pctUsed !== null && pctUsed >= 75 && monthlyDisposable > 0) ||
    (monthlyDisposable > 0 && leftThisMonth < monthlyDisposable * 0.12) ||
    guidance.band === "moderate"
  ) {
    warning = "close";
  }

  return {
    hasMetrics: guidance.monthlyTakeHome > 0,
    leftThisMonth,
    pctUsed,
    monthlyDisposable,
    runwayLeft,
    warning,
  };
}

/** Category totals for a specific calendar month (month is 0–11). */
export function getMonthCategoryTotals(
  expenses: Expense[],
  year: number,
  month: number
): Record<string, number> {
  return expenses.reduce(
    (acc, e) => {
      const d = new Date(e.created_at);
      if (d.getFullYear() !== year || d.getMonth() !== month) return acc;
      const key = e.category?.trim() || "Other";
      acc[key] = (acc[key] || 0) + Math.max(0, Number(e.amount) || 0);
      return acc;
    },
    {} as Record<string, number>
  );
}

const FOOD_CATEGORY_KEYS = ["Groceries", "Restaurants"] as const;

/** Share of this month’s spending vs prior calendar month (same categories). “Typical” = last month’s mix. */
export type CategoryMonthInsight = {
  name: string;
  amount: number;
  pctOfMonth: number;
  higherThanTypical: boolean;
};

export type CategoryInsightsSnapshot = {
  monthTotal: number;
  /** False when there was no spending last month — skip “vs typical” copy. */
  canComparePriorMonth: boolean;
  top: CategoryMonthInsight | null;
  food: {
    pct: number;
    priorMonthPct: number | null;
    higherThanTypical: boolean;
  } | null;
  ranked: CategoryMonthInsight[];
};

const TYPICAL_DELTA_PP = 6;

export function computeCategoryInsights(
  expenses: Expense[],
  now: Date = new Date()
): CategoryInsightsSnapshot | null {
  const monthTotal = getThisMonthSpending(expenses, now);
  if (monthTotal <= 0) return null;

  const y = now.getFullYear();
  const m = now.getMonth();
  const prevYear = m === 0 ? y - 1 : y;
  const prevMonth = m === 0 ? 11 : m - 1;

  const thisTotals = getThisMonthCategoryTotals(expenses, now);
  const prevTotals = getMonthCategoryTotals(expenses, prevYear, prevMonth);
  const prevMonthTotal = Object.values(prevTotals).reduce((a, b) => a + b, 0);
  const canComparePriorMonth = prevMonthTotal > 0;

  const ranked: CategoryMonthInsight[] = Object.entries(thisTotals)
    .map(([name, amount]) => {
      const pctOfMonth = (amount / monthTotal) * 100;
      const prevAmt = prevTotals[name] ?? 0;
      const pctPrev =
        prevMonthTotal > 0 ? (prevAmt / prevMonthTotal) * 100 : 0;
      const higherThanTypical =
        canComparePriorMonth && pctOfMonth > pctPrev + TYPICAL_DELTA_PP;
      return {
        name,
        amount,
        pctOfMonth: Math.round(pctOfMonth * 10) / 10,
        higherThanTypical,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const top = ranked[0] ?? null;

  let foodAmt = 0;
  for (const c of FOOD_CATEGORY_KEYS) {
    foodAmt += thisTotals[c] ?? 0;
  }
  let foodPrevAmt = 0;
  for (const c of FOOD_CATEGORY_KEYS) {
    foodPrevAmt += prevTotals[c] ?? 0;
  }
  const foodPct =
    monthTotal > 0 ? Math.round(((foodAmt / monthTotal) * 100) * 10) / 10 : 0;
  const foodPriorPct =
    prevMonthTotal > 0
      ? Math.round(((foodPrevAmt / prevMonthTotal) * 100) * 10) / 10
      : null;
  const food =
    foodAmt > 0
      ? {
          pct: foodPct,
          priorMonthPct: foodPriorPct,
          higherThanTypical:
            canComparePriorMonth &&
            foodPriorPct !== null &&
            foodPct > foodPriorPct + TYPICAL_DELTA_PP,
        }
      : null;

  return {
    monthTotal,
    canComparePriorMonth,
    top,
    food,
    ranked,
  };
}

/** Row for Recharts: `value` = amount, `name` = category label, `pct` = share of month (0–100). */
export type CategoryChartDatum = {
  name: string;
  value: number;
  pct: number;
};

/** This month only; sorted by amount descending. Percentages sum to ~100%. */
export function spendingByCategoryThisMonthChart(
  expenses: Expense[],
  now: Date = new Date()
): CategoryChartDatum[] {
  const totals = getThisMonthCategoryTotals(expenses, now);
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];
  return Object.entries(totals)
    .map(([name, v]) => ({
      name,
      value: v,
      pct: Math.round((v / sum) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);
}
