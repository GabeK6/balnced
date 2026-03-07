"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  Budget,
  Bill,
  Expense,
  getDaysUntil,
  formatMoney,
} from "@/lib/dashboard-data";

export default function InsightsPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [insight, setInsight] = useState("Generating insight...");
  const [loading, setLoading] = useState(true);

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

  const billsTotal = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const safeToSpend = budget ? Number(budget.balance) - billsTotal - expensesTotal : 0;
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

  async function refreshInsight() {
    if (!budget) return;

    try {
      setInsight("Generating insight...");

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

  useEffect(() => {
    refreshInsight();
  }, [
    budget?.balance,
    budget?.next_payday,
    safeToSpend,
    billsTotal,
    expensesTotal,
    dailySpendingLimit,
    categoryTotalsKey,
  ]);

  return (
    <DashboardShell
      title="Insights"
      subtitle="AI-powered commentary on your current budget and spending."
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Current Insight</h2>
            <button
              onClick={refreshInsight}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white"
            >
              Refresh
            </button>
          </div>

          <p className="mt-5 leading-8 text-slate-600">{insight}</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Snapshot</h2>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Safe to Spend</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(safeToSpend)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Bills Before Payday</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(billsTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Expenses</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(expensesTotal)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Daily Spending Limit</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatMoney(dailySpendingLimit)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}