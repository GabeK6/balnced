import type { Bill, RecurringBill } from "./dashboard-data";
import { parseDateOnlyLocal } from "./dashboard-data";
import {
  billIsPaid,
  getNextDueDate,
  isRecurringBillRow,
  normalizeBillDueDate,
  recurringBillIdsMatch,
} from "./recurring-bill-occurrences";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function ordinalDay(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Natural-language schedule from template fields only. */
export function describeRecurringSchedule(bill: RecurringBill): string {
  if (bill.frequency === "monthly" && bill.day_of_month != null) {
    const d = Number(bill.day_of_month);
    if (d >= 1 && d <= 31) {
      return `This bill occurs monthly on the ${ordinalDay(d)}.`;
    }
  }
  if (bill.frequency === "weekly" && bill.day_of_week != null) {
    const name = WEEKDAY_NAMES[bill.day_of_week];
    if (name) return `This bill occurs every week on ${name}.`;
  }
  if (bill.frequency === "biweekly" && bill.day_of_week != null) {
    const name = WEEKDAY_NAMES[bill.day_of_week];
    if (name) return `This bill occurs every other week on ${name}.`;
  }
  return `This bill repeats ${bill.frequency}.`;
}

/**
 * Next due on or after `now` (template rules), e.g. "April 1".
 */
export function formatNextDuePrediction(
  bill: RecurringBill,
  now: Date = new Date()
): string | null {
  const next = getNextDueDate(bill, now);
  if (!next) return null;
  const d = parseDateOnlyLocal(normalizeBillDueDate(next));
  if (!d) return null;
  const opts: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
  };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function calendarMonthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function decCalendarMonth(y: number, m0: number): { y: number; m0: number } {
  if (m0 <= 0) return { y: y - 1, m0: 11 };
  return { y, m0: m0 - 1 };
}

/**
 * Count of consecutive calendar months ending at the latest paid month, where this
 * template has at least one paid ledger row in each month (due date month).
 */
export function countConsecutivePaidMonthsStreak(
  template: RecurringBill,
  bills: Bill[]
): number {
  const paidMonths = new Set<string>();
  for (const b of bills) {
    if (b.archived || !billIsPaid(b) || !isRecurringBillRow(b)) continue;
    if (!recurringBillIdsMatch(b.recurring_bill_id, template.id)) continue;
    const head = normalizeBillDueDate(b.due_date);
    if (!head) continue;
    const d = parseDateOnlyLocal(head);
    if (!d) continue;
    paidMonths.add(calendarMonthKeyFromDate(d));
  }
  if (paidMonths.size === 0) return 0;

  let bestY = -1;
  let bestM0 = -1;
  for (const key of paidMonths) {
    const [ys, ms] = key.split("-").map(Number);
    const m0 = ms - 1;
    if (ys > bestY || (ys === bestY && m0 > bestM0)) {
      bestY = ys;
      bestM0 = m0;
    }
  }

  let streak = 0;
  let y = bestY;
  let m0 = bestM0;
  for (let i = 0; i < 120; i++) {
    const key = `${y}-${String(m0 + 1).padStart(2, "0")}`;
    if (paidMonths.has(key)) {
      streak++;
      const p = decCalendarMonth(y, m0);
      y = p.y;
      m0 = p.m0;
    } else {
      break;
    }
  }
  return streak;
}

export function formatPaidStreakLine(streak: number): string | null {
  if (streak >= 2) return `You've paid this ${streak} months in a row.`;
  if (streak === 1) return "Paid in 1 recent month—keep the streak going.";
  return null;
}
