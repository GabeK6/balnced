"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatDate,
  formatMoney,
  getDaysUntil,
  getExpectedPaycheck,
  Budget,
  Bill,
  Expense,
  RecurringBill,
} from "@/lib/dashboard-data";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export default function DashboardOverviewPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState("Generating insight...");

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();

      if (!data.user) {
        window.location.href = "/login";
        return;
      }

      setBudget(data.budget);
      setBills(data.bills);
      setExpenses(data.expenses);
      setRecurringBills(data.recurringBills);
      setLoading(false);
    }

    load();
  }, []);

  const upcomingBills = useMemo(() => {
    if (!budget) return [];

    const today = new Date();
    const payday = new Date(budget.next_payday);

    today.setHours(0, 0, 0, 0);
    payday.setHours(0, 0, 0, 0);

    return bills.filter((bill) => {
      const due = new Date(bill.due_date);
      due.setHours(0, 0, 0, 0);

      return !bill.archived && !bill.is_paid && due >= today && due <= payday;
    });
  }, [bills, budget]);

  const billsTotal = upcomingBills.reduce(
    (sum, bill) => sum + Number(bill.amount),
    0
  );

  const expensesTotal = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

const expectedPaycheck = getExpectedPaycheck(budget);

  const safeToSpend = budget
  ? Number(budget.balance) + expectedPaycheck - billsTotal - expensesTotal
  : 0;

  const daysUntilPayday = budget ? getDaysUntil(budget.next_payday) : 0;

  const dailySpendingLimit =
    daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;

  const categoryTotals = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      const category = expense.category || "Other";
      acc[category] = (acc[category] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  const categoryTotalsKey = useMemo(
    () => JSON.stringify(categoryTotals),
    [categoryTotals]
  );

  useEffect(() => {
    async function generateInsight() {
      if (!budget) return;

      try {
        const response = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balance: budget.balance,
            safeToSpend,
            billsTotal,
            expensesTotal,
            dailySpendingLimit,
            nextPayday: budget.next_payday,
            categories: categoryTotals,
          }),
        });

        const data = await response.json();
        setInsight(data.insight || "Could not generate AI insight right now.");
      } catch {
        setInsight("Could not generate AI insight right now.");
      }
    }

    generateInsight();
  }, [
    budget?.balance,
    budget?.next_payday,
    safeToSpend,
    billsTotal,
    expensesTotal,
    dailySpendingLimit,
    categoryTotalsKey,
  ]);

  const chartData = budget
    ? [
        { name: "Balance", value: Number(budget.balance) },
        { name: "Bills", value: billsTotal },
        { name: "Expenses", value: expensesTotal },
        { name: "Remaining", value: safeToSpend },
      ]
    : [];

  const chartColors: Record<string, string> = {
    Balance: "#3b82f6",
    Bills: "#ef4444",
    Expenses: "#f59e0b",
    Remaining: "#10b981",
  };

  const recentCategories = Object.entries(categoryTotals)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3);

  if (loading) {
    return (
      <DashboardShell title="Overview" subtitle="Loading your dashboard...">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-slate-600">Loading...</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Overview"
      subtitle="Your money at a glance, without the clutter."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-sm">
          <p className="text-sm text-emerald-50">Safe to Spend</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">
            {formatMoney(safeToSpend)}
          </p>
          <p className="mt-2 text-sm text-emerald-100">
            Available before your next payday
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-sm text-slate-500">Current Balance</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {formatMoney(Number(budget?.balance || 0))}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Your latest recorded balance
          </p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-sm text-slate-500">Next Payday</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {budget ? formatDate(budget.next_payday) : "--"}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {daysUntilPayday} day{daysUntilPayday === 1 ? "" : "s"} away
          </p>
        </div>

        <div className="rounded-[28px] bg-gradient-to-br from-blue-600 to-indigo-600 p-6 text-white shadow-sm">
          <p className="text-sm text-blue-100">Daily Limit</p>
          <p className="mt-3 text-4xl font-bold tracking-tight">
            {formatMoney(dailySpendingLimit)}
          </p>
          <p className="mt-2 text-sm text-blue-100">
            Based on days left until payday
          </p>
        </div>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Cash Flow Snapshot
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A quick view of where your money stands right now.
              </p>
            </div>

            <Link
              href="/dashboard/projection"
              className="inline-flex rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              View Projection
            </Link>
          </div>

          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap={30}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 13 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 13 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                  formatter={(value: number) => formatMoney(Number(value))}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                  }}
                />
                <Bar dataKey="value" radius={[14, 14, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[entry.name] || "#64748b"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                AI Insight
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Personalized guidance based on your current numbers.
              </p>
            </div>

            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-5">
            <p className="leading-8 text-slate-700">{insight}</p>
          </div>

          <Link
            href="/dashboard/insights"
            className="mt-6 inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Insights
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Upcoming Bills
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bills due before your next payday.
              </p>
            </div>

            <Link
              href="/dashboard/bills"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Manage
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {upcomingBills.slice(0, 4).map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{bill.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Due {formatDate(bill.due_date)}
                  </p>
                </div>

                <div className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-200">
                  {formatMoney(Number(bill.amount))}
                </div>
              </div>
            ))}

            {upcomingBills.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-5 text-slate-500">
                No bills due before payday.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Quick Stats
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A simple summary of your current cycle.
              </p>
            </div>

            <Link
              href="/dashboard/expenses"
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              View Expenses
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Bills Before Payday</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {formatMoney(billsTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Expenses</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {formatMoney(expensesTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Recurring Bills</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {recurringBills.length}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Top Spending Categories</p>

              {recentCategories.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentCategories.map(([category, total]) => (
                    <div
                      key={category}
                      className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {category}: {formatMoney(Number(total))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">
                  No spending categories yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}