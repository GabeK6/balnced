import { supabase } from "@/lib/supabase";

export type Budget = {
  id: string
  balance: number
  paycheck: number
  next_payday: string

  pay_type: "salary" | "hourly"
  pay_frequency: "weekly" | "biweekly" | "twice_monthly" | "monthly"

  hourly_rate?: number
  hours_worked?: number
};

export type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  is_paid?: boolean;
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

export function getExpectedPaycheck(budget: Budget | null) {
  if (!budget) return 0

  if (budget.pay_type === "hourly") {
    const rate = Number(budget.hourly_rate || 0)
    const hours = Number(budget.hours_worked || 0)
    return rate * hours
  }

  return Number(budget.paycheck || 0)
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}

export function formatMoney(value: number) {
  return `$${Number(value).toFixed(2)}`;
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
  const target = new Date(dateString);

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
  const sixtyDaysOut = addDays(today, 60);

  const { data: existingBillsData, error: existingBillsError } = await supabase
    .from("bills")
    .select("id, recurring_bill_id, due_date")
    .eq("user_id", userId)
    .not("recurring_bill_id", "is", null);

  if (existingBillsError) {
    console.error(existingBillsError.message);
    return;
  }

  const existingKeys = new Set(
    (existingBillsData || []).map(
      (bill) => `${bill.recurring_bill_id}-${bill.due_date}`
    )
  );

  const rowsToInsert: any[] = [];

  for (const recurringBill of recurringBills) {
    if (!recurringBill.active) continue;

    const startDate = recurringBill.start_date
      ? new Date(recurringBill.start_date)
      : new Date(today);

    const effectiveStart = startDate > today ? startDate : today;

    const endDate = recurringBill.end_date
      ? new Date(recurringBill.end_date)
      : sixtyDaysOut;

    const effectiveEnd = endDate < sixtyDaysOut ? endDate : sixtyDaysOut;

    if (effectiveStart > effectiveEnd) continue;

    let occurrences: string[] = [];

    if (recurringBill.frequency === "monthly" && recurringBill.day_of_month) {
      occurrences = getMonthlyOccurrences(
        recurringBill.day_of_month,
        effectiveStart,
        effectiveEnd
      );
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
      const key = `${recurringBill.id}-${dueDate}`;
      if (existingKeys.has(key)) continue;

      rowsToInsert.push({
        user_id: userId,
        name: recurringBill.name,
        amount: Number(recurringBill.amount),
        due_date: dueDate,
        is_paid: false,
        archived: false,
        recurring_bill_id: recurringBill.id,
        is_recurring: true,
      });

      existingKeys.add(key);
    }
  }

  if (rowsToInsert.length) {
    const { error } = await supabase.from("bills").insert(rowsToInsert);
    if (error) console.error(error.message);
  }
}

export async function loadDashboardData() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, budget: null, bills: [], expenses: [], recurringBills: [] };
  }

  const { data: budgetData } = await supabase
    .from("budgets")
    .select("balance, paycheck, next_payday")
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

  return {
    user,
    budget: budgetData as Budget | null,
    bills: (billsData || []) as Bill[],
    expenses: (expensesData || []) as Expense[],
    recurringBills,
  };
}