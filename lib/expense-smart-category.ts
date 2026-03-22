/**
 * Keyword-based category suggestions + local learned overrides (per user).
 * No server round-trip — matches product pattern for goals drafts.
 */

export const EXPENSE_CATEGORY_OPTIONS = [
  "Groceries",
  "Gas",
  "Restaurants",
  "Shopping",
  "Subscriptions",
  "Entertainment",
  "Other",
] as const;

export type ExpenseCategoryOption = (typeof EXPENSE_CATEGORY_OPTIONS)[number];

const STORAGE_PREFIX = "balnced_expense_category_learned_";

export function normalizeExpenseNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Order matters — first match wins. */
const KEYWORD_RULES: { category: ExpenseCategoryOption; keys: string[] }[] = [
  {
    category: "Groceries",
    keys: [
      "grocery",
      "kroger",
      "trader joe",
      "whole foods",
      "safeway",
      "aldi",
      "publix",
      "wegmans",
      "costco food",
      "market",
      "supermarket",
    ],
  },
  {
    category: "Gas",
    keys: ["gas", "shell", "exxon", "chevron", "bp ", "mobil", "fuel", "petro", "circle k gas"],
  },
  {
    category: "Restaurants",
    keys: [
      "restaurant",
      "cafe",
      "coffee",
      "starbucks",
      "dunkin",
      "mcdonald",
      "chipotle",
      "doordash",
      "uber eats",
      "grubhub",
      "pizza",
      "sushi",
      "bar & grill",
    ],
  },
  {
    category: "Shopping",
    keys: ["amazon", "target", "walmart", "ebay", "etsy", "best buy", "clothing", "nike", "apple store"],
  },
  {
    category: "Subscriptions",
    keys: [
      "netflix",
      "spotify",
      "hulu",
      "subscription",
      "adobe",
      "microsoft 365",
      "dropbox",
      "icloud",
    ],
  },
  {
    category: "Entertainment",
    keys: ["movie", "cinema", "theater", "concert", "ticket", "steam", "playstation", "xbox", "games"],
  },
];

export function suggestCategoryFromKeywords(name: string): ExpenseCategoryOption | null {
  const n = name.toLowerCase();
  for (const { category, keys } of KEYWORD_RULES) {
    for (const k of keys) {
      if (n.includes(k)) return category;
    }
  }
  return null;
}

export function suggestCategory(
  name: string,
  learned: Record<string, ExpenseCategoryOption>
): ExpenseCategoryOption | null {
  const key = normalizeExpenseNameKey(name);
  if (!key) return null;
  if (learned[key]) return learned[key];
  return suggestCategoryFromKeywords(name);
}

export function loadLearnedCategories(userId: string): Record<string, ExpenseCategoryOption> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, ExpenseCategoryOption> = {};
    for (const [k, v] of Object.entries(p)) {
      if (EXPENSE_CATEGORY_OPTIONS.includes(v as ExpenseCategoryOption)) {
        out[k] = v as ExpenseCategoryOption;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveLearnedCategories(
  userId: string,
  map: Record<string, ExpenseCategoryOption>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** When user picks a category for a name, remember for next time. */
export function rememberCategoryChoice(
  userId: string,
  expenseName: string,
  category: ExpenseCategoryOption,
  prev: Record<string, ExpenseCategoryOption>
): Record<string, ExpenseCategoryOption> {
  const key = normalizeExpenseNameKey(expenseName);
  if (!key) return prev;
  const next = { ...prev, [key]: category };
  saveLearnedCategories(userId, next);
  return next;
}
