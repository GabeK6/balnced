import type { ExpenseCategoryOption } from "@/lib/expense-smart-category";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/expense-smart-category";

const STORAGE_PREFIX = "balnced_category_budgets_";

/** `YYYY-MM` -> category -> monthly cap in dollars */
export type CategoryBudgetsByMonth = Record<string, Partial<Record<ExpenseCategoryOption, number>>>;

export function yearMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function loadCategoryBudgets(userId: string): CategoryBudgetsByMonth {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    return JSON.parse(raw) as CategoryBudgetsByMonth;
  } catch {
    return {};
  }
}

export function saveCategoryBudgets(userId: string, data: CategoryBudgetsByMonth): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function setCategoryBudget(
  userId: string,
  ym: string,
  category: ExpenseCategoryOption,
  amount: number,
  all: CategoryBudgetsByMonth
): CategoryBudgetsByMonth {
  const next = { ...all };
  const row = { ...(next[ym] ?? {}) };
  if (amount <= 0 || !Number.isFinite(amount)) {
    delete row[category];
  } else {
    row[category] = Math.round(amount * 100) / 100;
  }
  if (Object.keys(row).length === 0) delete next[ym];
  else next[ym] = row;
  saveCategoryBudgets(userId, next);
  return next;
}

export function budgetsForMonth(
  all: CategoryBudgetsByMonth,
  ym: string
): Partial<Record<ExpenseCategoryOption, number>> {
  return all[ym] ?? {};
}

export function categoriesWithBudgetsFirst(
  budgets: Partial<Record<ExpenseCategoryOption, number>>
): ExpenseCategoryOption[] {
  const withBudget = EXPENSE_CATEGORY_OPTIONS.filter((c) => (budgets[c] ?? 0) > 0);
  const rest = EXPENSE_CATEGORY_OPTIONS.filter((c) => !withBudget.includes(c));
  return [...withBudget, ...rest];
}
