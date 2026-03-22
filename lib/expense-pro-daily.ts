import type { ExpensesSafeGuidance } from "@/lib/expense-dashboard-summaries";

export type ProEnhancedDailyResult = {
  /** Same as guidance: runway / days until payday */
  runwayDaily: number;
  /** Safe runway spread across rest of calendar month */
  monthCalendarDaily: number;
  /** Blended limit with pace adjustment */
  adjustedDaily: number;
  paceNote: string;
};

/**
 * Pro-only: blends payday runway with calendar-month pacing and light adjustment
 * when this month’s spend is ahead/behind a simple linear expectation.
 */
export function computeProEnhancedDailyLimit(
  guidance: ExpensesSafeGuidance,
  now: Date = new Date()
): ProEnhancedDailyResult {
  if (!guidance.canCompute) {
    return {
      runwayDaily: 0,
      monthCalendarDaily: 0,
      adjustedDaily: 0,
      paceNote: "",
    };
  }

  const runwaySafe = Math.max(0, guidance.runwaySafe);
  const daysPayday = Math.max(1, guidance.daysUntilPayday);
  const runwayDaily = runwaySafe / daysPayday;

  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeftInMonth = Math.max(1, daysInMonth - dayOfMonth + 1);
  const monthCalendarDaily = runwaySafe / daysLeftInMonth;

  const disposable = Math.max(
    0,
    guidance.monthlyTakeHome - guidance.monthlyBills - guidance.monthlyGoals
  );
  const linearExpectedToDate =
    disposable > 0 ? (disposable / daysInMonth) * dayOfMonth : 0;
  const spent = guidance.spentThisMonth;
  let paceRatio =
    linearExpectedToDate > 0.01 ? spent / linearExpectedToDate : spent > 0 ? 2 : 1;

  let factor = 1;
  let paceNote = "Spending pace looks aligned with a simple monthly plan.";
  if (paceRatio > 1.2) {
    factor = 0.88;
    paceNote = "You’re ahead of a simple monthly pace — daily limit is tightened slightly.";
  } else if (paceRatio < 0.75 && spent > 0) {
    factor = 1.06;
    paceNote = "You’re under a simple monthly pace so far — a bit more room per day.";
  }

  const base = Math.min(runwayDaily, monthCalendarDaily);
  let adjustedDaily = Math.max(0, base * factor);

  /** Don’t exceed what’s left this month if disposable is known */
  if (disposable > 0 && daysLeftInMonth > 0) {
    const headroom = Math.max(0, disposable - spent);
    const cap = headroom / daysLeftInMonth;
    adjustedDaily = Math.min(adjustedDaily, cap);
  }

  return {
    runwayDaily,
    monthCalendarDaily,
    adjustedDaily,
    paceNote,
  };
}
