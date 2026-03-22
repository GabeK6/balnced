import type { Expense } from "@/lib/dashboard-data";
import {
  getThisMonthSpending,
  sumExpensesInRange,
  weekOverWeekTrend,
} from "@/lib/expense-dashboard-summaries";

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

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Rolling 7d vs prior 7d spend per category — find biggest positive swing. */
function categoryWeekOverWeekDeltas(
  expenses: Expense[],
  now: Date
): { name: string; thisWeek: number; lastWeek: number; delta: number }[] {
  const today = startOfDay(now);
  const thisStart = addDays(today, -6);
  const lastEnd = endOfDay(addDays(today, -7));
  const lastStart = startOfDay(addDays(today, -13));

  const cats = new Set<string>();
  for (const e of expenses) {
    cats.add(e.category?.trim() || "Other");
  }

  const out: { name: string; thisWeek: number; lastWeek: number; delta: number }[] = [];
  for (const name of cats) {
    const thisWeek = expenses
      .filter((e) => (e.category?.trim() || "Other") === name)
      .filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= thisStart.getTime() && t <= endOfDay(now).getTime();
      })
      .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);

    const lastWeek = expenses
      .filter((e) => (e.category?.trim() || "Other") === name)
      .filter((e) => {
        const t = new Date(e.created_at).getTime();
        return t >= lastStart.getTime() && t <= lastEnd.getTime();
      })
      .reduce((s, e) => s + Math.max(0, Number(e.amount) || 0), 0);

    out.push({ name, thisWeek, lastWeek, delta: thisWeek - lastWeek });
  }
  return out.sort((a, b) => b.delta - a.delta);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Single expense much larger than typical for that category this month.
 */
function unusualExpenses(expenses: Expense[], now: Date): { name: string; amount: number; label: string }[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.created_at);
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const byCat: Record<string, number[]> = {};
  for (const e of monthExpenses) {
    const cat = e.category?.trim() || "Other";
    const amt = Math.max(0, Number(e.amount) || 0);
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(amt);
  }

  const out: { name: string; amount: number; label: string }[] = [];
  for (const e of monthExpenses) {
    const cat = e.category?.trim() || "Other";
    const amt = Math.max(0, Number(e.amount) || 0);
    const list = byCat[cat] ?? [];
    if (list.length < 3) continue;
    const med = median(list);
    if (med <= 0) continue;
    if (amt >= med * 2.5 && amt >= 25) {
      out.push({
        name: e.name || "Expense",
        amount: amt,
        label: `${cat} · larger than typical`,
      });
    }
  }
  return out.slice(0, 5);
}

export type ProSpendingInsights = {
  wow: ReturnType<typeof weekOverWeekTrend>;
  wowLine: string | null;
  spikeLine: string | null;
  unusualLines: string[];
};

export function computeProSpendingInsights(
  expenses: Expense[],
  now: Date = new Date()
): ProSpendingInsights {
  const wow = weekOverWeekTrend(expenses, now);

  let wowLine: string | null = null;
  if (wow.direction === "none" || (wow.thisWeek <= 0 && wow.lastWeek <= 0)) {
    wowLine = null;
  } else if (wow.pctChange != null) {
    wowLine =
      wow.direction === "same"
        ? `Week over week: spending is about flat vs last week (${wow.pctChange.toFixed(0)}%).`
        : wow.direction === "up"
          ? `Week over week: spending is up about ${Math.abs(wow.pctChange).toFixed(0)}% vs last week.`
          : `Week over week: spending is down about ${Math.abs(wow.pctChange).toFixed(0)}% vs last week.`;
  } else if (wow.direction === "up") {
    wowLine = "Week over week: spending increased vs last week.";
  }

  const deltas = categoryWeekOverWeekDeltas(expenses, now);
  const spike = deltas.find((d) => d.delta > 15 && d.thisWeek > 0);
  let spikeLine: string | null = null;
  if (spike) {
    spikeLine = `${spike.name} is up about $${Math.round(spike.delta)} vs the prior week (rolling 7 days).`;
  }

  const unusual = unusualExpenses(expenses, now);
  const unusualLines = unusual.map((u) => `${u.name} — $${u.amount.toFixed(2)} (${u.label})`);

  return { wow, wowLine, spikeLine, unusualLines };
}

/** Last `days` calendar days of total spend (for chart). */
export function dailyTotalSpendSeries(
  expenses: Expense[],
  now: Date,
  days: number
): { date: string; label: string; amount: number }[] {
  const out: { date: string; label: string; amount: number }[] = [];
  const today = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const amount = sumExpensesInRange(expenses, day, endOfDay(day));
    const date = day.toISOString().slice(0, 10);
    out.push({
      date,
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount,
    });
  }
  return out;
}

export function monthToDateAverageDaily(expenses: Expense[], now: Date): number {
  const total = getThisMonthSpending(expenses, now);
  const dom = now.getDate();
  return dom > 0 ? total / dom : 0;
}
