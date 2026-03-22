import { supabase } from "@/lib/supabase";
import { billPaidFields } from "@/lib/bill-paid-fields";
import type { PlanTier } from "@/lib/plan";
import { fetchUserPlanAccess, type PlanAccessState } from "@/lib/plan-access";
import { debtFromRow, type Debt } from "@/lib/debt-types";

export type { Debt } from "@/lib/debt-types";

export type Budget = {
  id?: string
  balance: number
  paycheck: number
  next_payday: string

  pay_type?: "salary" | "hourly" | null
  pay_frequency?: "weekly" | "biweekly" | "twice_monthly" | "monthly" | null

  hourly_rate?: number | null
  hours_worked?: number | null
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  is_paid?: boolean;
  /** When the user marked this row paid (optional column until migration applied). */
  paid_at?: string | null;
  archived?: boolean;
  recurring_bill_id?: string | null;
  is_recurring?: boolean;
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  created_at: string;
  category?: string;
  archived?: boolean;
};

export type RecurringBill = {
  id: string;
  name: string;
  amount: number;
  category?: string | null;
  frequency: "monthly" | "weekly" | "biweekly";
  day_of_month?: number | null;
  day_of_week?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean;
  created_at?: string;
};

/** Big-purchase template for guided goal setup (optional for backward compatibility). */
export type SavingsGoalKind = "house" | "car" | "emergency_fund" | "custom";

/** Savings target; lower `priority` number is funded first (1 = top priority). */
export type SavingsGoalItem = {
  id: string;
  name: string;
  amount: number;
  priority: number;
  /** Optional: House / Car / Emergency / Custom guided flow */
  goal_kind?: SavingsGoalKind;
  /** House: approximate purchase price (down payment = price × down_payment_percent). */
  house_price?: number;
  /** House: down payment percent (e.g. 20 = 20%). */
  down_payment_percent?: number;
  /** Car: hoped timeline in months (guidance vs. projected funding). */
  car_target_months?: number;
  /** Emergency fund: months of take-home to cover. */
  emergency_months?: number;
};

/** Client-side edits to a savings goal draft (id/priority managed separately). */
export type SavingsGoalDraftPatch = Partial<
  Omit<SavingsGoalItem, "id" | "priority">
>;

export type UserGoals = {
  retirement_age: number;
  invest_percent?: number;
  save_percent?: number;
  /** @deprecated Prefer savings_goals; kept in sync with priority-1 goal for older callers */
  big_purchase_name?: string | null;
  big_purchase_amount?: number | null;
  savings_goals?: SavingsGoalItem[];
};

export function getExpectedPaycheck(budget: Budget | null): number {
  if (!budget) return 0;

  if (budget.pay_type === "hourly") {
    const rate = Number(budget.hourly_rate ?? 0);
    const hours = Number(budget.hours_worked ?? 0);
    return rate * hours;
  }

  return Number(budget.paycheck ?? 0);
}

/** Pay frequency → number of paychecks per year. Use for annual ↔ per-paycheck conversion. */
export function getPaychecksPerYear(
  payFrequency: string | null | undefined
): number {
  switch (payFrequency) {
    case "monthly":
      return 12;
    case "biweekly":
      return 26;
    case "weekly":
      return 52;
    case "twice_monthly":
      return 24;
    default:
      return 26;
  }
}

/** Pay frequency → number of paychecks per month. Single source of truth for conversion. */
export function getPaychecksPerMonth(budget: Budget | null): number {
  if (!budget?.pay_frequency) return 2;
  const perYear = getPaychecksPerYear(budget.pay_frequency);
  return perYear / 12;
}

/** Monthly take-home pay (same units as suggestedMonthlyInvest / suggestedMonthlySave). */
export function getMonthlyPay(budget: Budget | null): number {
  const paycheck = getExpectedPaycheck(budget);
  const paychecksPerMonth = getPaychecksPerMonth(budget);
  return paycheck * paychecksPerMonth;
}

/** Annual take-home pay derived from budget (paycheck × pay frequency). */
export function getAnnualPay(budget: Budget | null): number {
  return getMonthlyPay(budget) * 12;
}

/**
 * Cash left after logged expenses — same definition as Overview "Current balance".
 * Starts from the user's bank balance (`budgets.balance`), not raw income alone.
 */
export function computeAvailableBalance(
  budget: Budget | null,
  expenses: Expense[]
): number {
  if (!budget) return 0;
  const base = Number(budget.balance);
  if (!Number.isFinite(base)) return 0;
  const expensesTotal = expenses
    .filter((e) => !e.archived)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  return base - expensesTotal;
}

/** Get future payday dates from a starting date using pay frequency. */
export function getRecurringPaydays(
  nextPayday: string,
  payFrequency: string | null | undefined,
  count: number
): string[] {
  if (!nextPayday || count < 1) return [];

  const cursor = new Date(nextPayday);
  if (Number.isNaN(cursor.getTime())) return [];

  const dates: string[] = [];
  let cur = new Date(cursor);
  cur.setHours(0, 0, 0, 0);
  const dayOfMonth = cur.getDate();

  const freq = payFrequency || "";

  for (let i = 0; i < count; i++) {
    dates.push(toDateOnly(cur));

    if (freq === "weekly") {
      cur.setDate(cur.getDate() + 7);
    } else if (freq === "biweekly" || freq === "twice_monthly") {
      cur.setDate(cur.getDate() + 14);
    } else if (freq === "monthly") {
      cur.setMonth(cur.getMonth() + 1);
      const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      cur.setDate(Math.min(dayOfMonth, lastDay));
    } else {
      break;
    }
  }

  return dates;
}

/** Get the next payday (today or in the future), auto-advancing if stored date is in the past. */
export function getNextPayday(budget: Budget | null): string | null {
  if (!budget?.next_payday) return null;

  const stored = new Date(budget.next_payday);
  if (Number.isNaN(stored.getTime())) return budget.next_payday;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  stored.setHours(0, 0, 0, 0);

  if (stored >= today) return budget.next_payday;

  const upcoming = getRecurringPaydays(budget.next_payday, budget.pay_frequency ?? null, 12);
  if (!upcoming.length) return budget.next_payday;

  const next = upcoming.find((d) => new Date(d) >= today);
  return next ?? upcoming[upcoming.length - 1] ?? budget.next_payday;
}

/**
 * Parse `YYYY-MM-DD` as a local calendar date.
 * `new Date("YYYY-MM-DD")` is treated as UTC midnight and shifts a day in western zones.
 */
export function parseDateOnlyLocal(dateString: string): Date | null {
  const s = String(dateString ?? "").trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
    return dt;
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
}

export function formatDate(dateString: string) {
  const d = parseDateOnlyLocal(dateString);
  if (!d) return String(dateString);
  return d.toLocaleDateString();
}

/** Full timestamp for expense rows (ISO from DB → local date + time). */
export function formatExpenseDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleString("en-US", opts);
}

export function formatDateMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatDateShort(dateString: string) {
  const d = parseDateOnlyLocal(dateString);
  if (!d) return String(dateString);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/** Bill cards: weekday + date (local), easy to scan. */
export function formatBillDuePrimary(dateString: string) {
  const d = parseDateOnlyLocal(dateString);
  if (!d) return String(dateString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** USD, en-US, always 2 decimal places — use for all user-visible money in the app. */
export function formatMoney(value: number) {
  const n = Number.isFinite(value) ? Number(value) : 0;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Active savings goals sorted by priority (1 = fund first). Uses `savings_goals` or legacy big purchase fields. */
export function getEffectiveSavingsGoals(goals: UserGoals | null): SavingsGoalItem[] {
  if (!goals) return [];
  if (Array.isArray(goals.savings_goals) && goals.savings_goals.length > 0) {
    return [...goals.savings_goals]
      .filter((g) => (g.name ?? "").trim().length > 0 && Number(g.amount) > 0)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
      .map((g, i) => ({
        ...g,
        name: (g.name ?? "").trim(),
        amount: Number(g.amount),
        priority: i + 1,
      }));
  }
  if (
    goals.big_purchase_name?.trim() &&
    goals.big_purchase_amount != null &&
    Number(goals.big_purchase_amount) > 0
  ) {
    return [
      {
        id: "legacy-big-purchase",
        name: goals.big_purchase_name.trim(),
        amount: Number(goals.big_purchase_amount),
        priority: 1,
      },
    ];
  }
  return [];
}

export type SavingsGoalTimeline = {
  id: string;
  name: string;
  amount: number;
  targetDate: Date;
  months: number;
  priority: number;
};

/**
 * Waterfall timelines: full monthly save rate goes to priority 1 until met, then priority 2, etc.
 */
export function getSavingsGoalTimelines(
  budget: Budget | null,
  goals: UserGoals | null,
  monthlySavingsOverride?: number
): SavingsGoalTimeline[] {
  const list = getEffectiveSavingsGoals(goals);
  if (!list.length) return [];

  let monthlySavings = monthlySavingsOverride;

  if (monthlySavings == null && budget && goals) {
    const monthlyPay = getMonthlyPay(budget);
    const savePct = goals.save_percent ?? 0;
    monthlySavings = monthlyPay * (savePct / 100);
  }

  if (!monthlySavings || monthlySavings <= 0) return [];

  let offsetMonths = 0;
  const out: SavingsGoalTimeline[] = [];
  for (const g of list) {
    const amount = Number(g.amount);
    if (!amount || amount <= 0) continue;
    const months = Math.ceil(amount / monthlySavings);
    offsetMonths += months;
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + offsetMonths);
    out.push({
      id: g.id,
      name: g.name,
      amount,
      months,
      targetDate,
      priority: g.priority,
    });
  }
  return out;
}

/** First milestone only (backward compatible with single-goal UI helpers). */
export function getSavingsTimeline(
  budget: Budget | null,
  goals: UserGoals | null,
  monthlySavingsOverride?: number
): { name: string; amount: number; targetDate: Date; months: number } | null {
  const rows = getSavingsGoalTimelines(budget, goals, monthlySavingsOverride);
  const first = rows[0];
  if (!first) return null;
  return {
    name: first.name,
    amount: first.amount,
    targetDate: first.targetDate,
    months: first.months,
  };
}

/** Set legacy big_purchase_* from the highest-priority goal for API compatibility. */
export function withSyncedLegacyBigPurchase(goals: UserGoals): UserGoals {
  const sorted = getEffectiveSavingsGoals(goals);
  const top = sorted[0];
  if (!top) {
    return {
      ...goals,
      big_purchase_name: null,
      big_purchase_amount: null,
    };
  }
  return {
    ...goals,
    big_purchase_name: top.name,
    big_purchase_amount: top.amount,
  };
}

export function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDaysUntil(dateString: string) {
  const today = new Date();
  const target = parseDateOnlyLocal(dateString) ?? new Date(dateString);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays < 0 ? 0 : diffDays;
}

function getMonthlyOccurrences(dayOfMonth: number, start: Date, end: Date) {
  const occurrences: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(dayOfMonth, lastDay);
    const occurrence = new Date(year, month, safeDay);

    if (occurrence >= start && occurrence <= end) {
      occurrences.push(toDateOnly(occurrence));
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return occurrences;
}

function getWeeklyOccurrences(
  dayOfWeek: number,
  start: Date,
  end: Date,
  intervalDays: number
) {
  const occurrences: string[] = [];
  const cursor = new Date(start);

  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cursor <= end) {
    occurrences.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + intervalDays);
  }

  return occurrences;
}

export async function generateRecurringBills(
  userId: string,
  recurringBills: RecurringBill[]
) {
  if (!recurringBills.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ninetyDaysOut = addDays(today, 90);
  /**
   * Only materialize ledger rows from the start of the previous calendar month forward.
   * A multi-year lookback created huge historical runs (weekly/monthly) and inflated Projection/“overdue”.
   */
  const lookback = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  lookback.setHours(0, 0, 0, 0);

  const { data: existingBillsData, error: existingBillsError } = await supabase
    .from("bills")
    .select("id, recurring_bill_id, due_date")
    .eq("user_id", userId)
    .not("recurring_bill_id", "is", null);

  if (existingBillsError) {
    console.error(existingBillsError.message);
    return;
  }

  /** Match keys on calendar date only (DB may return ISO timestamps). */
  function dueKey(iso: string | null | undefined): string {
    if (iso == null || iso === "") return "";
    const s = String(iso).trim();
    const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return ymd ? ymd[1] : toDateOnly(new Date(s));
  }

  const existingKeys = new Set(
    (existingBillsData || []).map(
      (bill) => `${bill.recurring_bill_id}-${dueKey(bill.due_date)}`
    )
  );

  const rowsToInsert: any[] = [];

  for (const recurringBill of recurringBills) {
    if (!recurringBill.active) continue;

    const templateStart = recurringBill.start_date
      ? new Date(recurringBill.start_date)
      : lookback;
    templateStart.setHours(0, 0, 0, 0);

    let effectiveStart: Date;
    if (templateStart.getTime() > today.getTime()) {
      effectiveStart = templateStart;
    } else {
      effectiveStart =
        templateStart.getTime() > lookback.getTime() ? templateStart : lookback;
    }

    const endDate = recurringBill.end_date
      ? new Date(recurringBill.end_date)
      : ninetyDaysOut;

    const effectiveEnd = endDate < ninetyDaysOut ? endDate : ninetyDaysOut;

    if (effectiveStart > effectiveEnd) continue;

    let occurrences: string[] = [];

    if (
      recurringBill.frequency === "monthly" &&
      recurringBill.day_of_month != null
    ) {
      const dom = Number(recurringBill.day_of_month);
      if (dom >= 1 && dom <= 31) {
        occurrences = getMonthlyOccurrences(
          dom,
          effectiveStart,
          effectiveEnd
        );
      }
    }

    if (
      recurringBill.frequency === "weekly" &&
      recurringBill.day_of_week !== null &&
      recurringBill.day_of_week !== undefined
    ) {
      occurrences = getWeeklyOccurrences(
        recurringBill.day_of_week,
        effectiveStart,
        effectiveEnd,
        7
      );
    }

    if (
      recurringBill.frequency === "biweekly" &&
      recurringBill.day_of_week !== null &&
      recurringBill.day_of_week !== undefined
    ) {
      occurrences = getWeeklyOccurrences(
        recurringBill.day_of_week,
        effectiveStart,
        effectiveEnd,
        14
      );
    }

    for (const dueDate of occurrences) {
      const key = `${recurringBill.id}-${dueKey(dueDate)}`;
      if (existingKeys.has(key)) continue;

      rowsToInsert.push({
        user_id: userId,
        name: recurringBill.name,
        amount: Number(recurringBill.amount),
        due_date: dueKey(dueDate) || dueDate,
        archived: false,
        recurring_bill_id: recurringBill.id,
        is_recurring: true,
        ...billPaidFields(false),
      });

      existingKeys.add(key);
    }
  }

  if (rowsToInsert.length) {
    const { error } = await supabase.from("bills").insert(rowsToInsert);
    if (error) console.error(error.message);
  }
}

/**
 * Loads budget, bills, expenses, and recurring data for dashboard surfaces.
 * `plan` / `hasProAccess` / `planAccess` reflect the DB at fetch time; on the client, prefer
 * `useUserPlan()` for Pro gating so UI stays in sync after focus refresh or trial changes.
 */
export async function loadDashboardData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      budget: null,
      bills: [],
      expenses: [],
      recurringBills: [],
      debts: [] as Debt[],
      plan: "free" as PlanTier,
      hasProAccess: false,
      planAccess: null as PlanAccessState | null,
      availableBalance: null as number | null,
    };
  }

  const planAccess = await fetchUserPlanAccess(supabase);
  const plan: PlanTier = planAccess?.plan ?? "free";
  const hasProAccess = planAccess?.hasProAccess ?? false;

  const { data: budgetData } = await supabase
    .from("budgets")
    .select("balance, paycheck, next_payday, pay_type, pay_frequency, hourly_rate, hours_worked")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: recurringData } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  const recurringBills = (recurringData || []) as RecurringBill[];

  await generateRecurringBills(user.id, recurringBills);

  const { data: billsData } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("due_date", { ascending: true });

  const { data: expensesData } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  const { data: debtsData, error: debtsError } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .order("balance", { ascending: false });

  if (debtsError) {
    console.error("[balnced] debts load failed:", debtsError.message);
  }

  const debts: Debt[] = (debtsData || []).map((row) =>
    debtFromRow(row as Record<string, unknown>)
  );

  const expenses = (expensesData || []) as Expense[];
  const budget = budgetData as Budget | null;

  return {
    user,
    budget,
    bills: (billsData || []) as Bill[],
    expenses,
    recurringBills,
    debts,
    plan,
    hasProAccess,
    planAccess,
    availableBalance: computeAvailableBalance(budget, expenses),
  };
}

const GOALS_STORAGE_KEY = "balnced_user_goals";

const VALID_GOAL_KINDS = new Set<string>([
  "house",
  "car",
  "emergency_fund",
  "custom",
]);

function parseStoredGoalKind(v: unknown): SavingsGoalKind | undefined {
  if (typeof v !== "string" || !VALID_GOAL_KINDS.has(v)) return undefined;
  return v as SavingsGoalKind;
}

function normalizeStoredSavingsGoals(raw: unknown): SavingsGoalItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((x: unknown, i: number) => {
      const o = x as Record<string, unknown>;
      const house_price = o?.house_price != null ? Number(o.house_price) : undefined;
      const down_payment_percent =
        o?.down_payment_percent != null ? Number(o.down_payment_percent) : undefined;
      const car_target_months =
        o?.car_target_months != null ? Number(o.car_target_months) : undefined;
      const emergency_months =
        o?.emergency_months != null ? Number(o.emergency_months) : undefined;
      return {
        id: typeof o?.id === "string" && o.id ? o.id : `goal-${i}`,
        name: String(o?.name ?? "").trim(),
        amount: Math.max(0, Number(o?.amount) || 0),
        priority: Number.isFinite(Number(o?.priority)) ? Number(o.priority) : i + 1,
        goal_kind: parseStoredGoalKind(o?.goal_kind),
        house_price:
          house_price != null && Number.isFinite(house_price) && house_price >= 0
            ? house_price
            : undefined,
        down_payment_percent:
          down_payment_percent != null &&
          Number.isFinite(down_payment_percent) &&
          down_payment_percent >= 0
            ? Math.min(100, down_payment_percent)
            : undefined,
        car_target_months:
          car_target_months != null &&
          Number.isFinite(car_target_months) &&
          car_target_months >= 0
            ? car_target_months
            : undefined,
        emergency_months:
          emergency_months != null &&
          Number.isFinite(emergency_months) &&
          emergency_months > 0
            ? emergency_months
            : undefined,
      };
    })
    .filter((g) => g.name.length > 0 && g.amount > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((g, i) => ({ ...g, priority: i + 1 }));
  return items.length ? items : undefined;
}

export function loadUserGoals(userId: string): UserGoals | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${GOALS_STORAGE_KEY}_${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserGoals;
    let savings_goals = normalizeStoredSavingsGoals(parsed.savings_goals);
    if (!savings_goals?.length && parsed.big_purchase_name?.trim()) {
      const amt = parsed.big_purchase_amount != null ? Number(parsed.big_purchase_amount) : 0;
      if (amt > 0) {
        savings_goals = [
          {
            id: "migrated",
            name: String(parsed.big_purchase_name).trim(),
            amount: amt,
            priority: 1,
          },
        ];
      }
    }
    const base: UserGoals = {
      retirement_age: Number(parsed.retirement_age) || 65,
      invest_percent: parsed.invest_percent != null ? Number(parsed.invest_percent) : undefined,
      save_percent: parsed.save_percent != null ? Number(parsed.save_percent) : undefined,
      big_purchase_name: parsed.big_purchase_name ?? null,
      big_purchase_amount:
        parsed.big_purchase_amount != null ? Number(parsed.big_purchase_amount) : null,
      savings_goals,
    };
    return withSyncedLegacyBigPurchase(base);
  } catch {
    return null;
  }
}

export function saveUserGoals(userId: string, goals: UserGoals): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${GOALS_STORAGE_KEY}_${userId}`, JSON.stringify(goals));
  } catch {
    // ignore
  }
}