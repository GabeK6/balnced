import type { Expense } from "@/lib/dashboard-data";

/** Local calendar day key `YYYY-MM-DD` for an expense timestamp. */
export function localDayKeyFromExpense(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sum of expense amounts per local calendar day (all loaded expenses). */
export function sumExpensesByLocalDay(expenses: Expense[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of expenses) {
    const k = localDayKeyFromExpense(e.created_at);
    if (!k) continue;
    m[k] = (m[k] ?? 0) + Number(e.amount);
  }
  return m;
}

export type ExpenseEntryContext = {
  pctOfDay: number | null;
  pctOfCategory: number | null;
  isHighSpend: boolean;
};

/**
 * pctOfDay: share of that calendar day's total spending.
 * pctOfCategory: share of all-time category total (same as category breakdown panel).
 */
export function getExpenseEntryContext(
  expense: Expense,
  dayTotal: number,
  categoryTotalAllTime: number
): ExpenseEntryContext {
  const amt = Number(expense.amount);
  const pctOfDay =
    dayTotal > 0 ? Math.round((amt / dayTotal) * 1000) / 10 : null;
  const pctOfCategory =
    categoryTotalAllTime > 0
      ? Math.round((amt / categoryTotalAllTime) * 1000) / 10
      : null;

  const isHighSpend =
    (pctOfDay != null && pctOfDay >= 45) ||
    (pctOfCategory != null && pctOfCategory >= 38 && categoryTotalAllTime >= 25);

  return { pctOfDay, pctOfCategory, isHighSpend };
}
