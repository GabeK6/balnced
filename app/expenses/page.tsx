"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatDate,
  formatMoney,
  Expense,
} from "@/lib/dashboard-data";
import { supabase } from "@/lib/supabase";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setExpenses(data.expenses);
      setLoading(false);
    }
    load();
  }, []);

  const categoryTotals = useMemo(() => {
    return expenses.reduce((acc, expense) => {
      const key = expense.category || "Other";
      acc[key] = (acc[key] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);
  }, [expenses]);

  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    return entries[0] ?? null;
  }, [categoryTotals]);

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        name,
        amount: Number(amount),
        category,
        archived: false,
      })
      .select("*")
      .single();

    if (error) return alert("Could not save expense.");

    setExpenses((prev) => [data as Expense, ...prev]);
    setName("");
    setAmount("");
    setCategory("");
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return alert("Could not delete expense.");
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  }

  return (
    <DashboardShell
      title="Expenses"
      subtitle="Log spending to improve safe-to-spend and Insights."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="grid h-full min-h-0 gap-4 sm:gap-5 lg:grid-cols-3">
        <div className="balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-100">Add expense</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Logging expenses improves your daily limit and guidance.
          </p>
          <form onSubmit={addExpense} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Expense name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="balnced-input"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="balnced-input"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="balnced-input"
              required
            >
              <option value="">Select category</option>
              <option value="Groceries">Groceries</option>
              <option value="Gas">Gas</option>
              <option value="Restaurants">Restaurants</option>
              <option value="Shopping">Shopping</option>
              <option value="Subscriptions">Subscriptions</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Add expense
            </button>
          </form>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="shrink-0 text-base font-semibold text-slate-100">Category totals</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            All time. Feeds Insights and safe-to-spend.
          </p>
          {!loading && thisMonthTotal > 0 && (
            <div className="mt-3 balnced-row rounded-xl p-4">
              <p className="text-xs text-slate-500">This month</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                {formatMoney(thisMonthTotal)}
              </p>
              {topCategory && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Top: {topCategory[0]} {formatMoney(topCategory[1])}
                </p>
              )}
            </div>
          )}
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([key, total]) => (
                <div
                  key={key}
                  className="flex items-center justify-between balnced-row rounded-xl px-4 py-2.5"
                >
                  <span className="text-sm font-medium text-slate-100">{key}</span>
                  <span className="text-sm font-semibold text-slate-100">
                    {formatMoney(Number(total))}
                  </span>
                </div>
              ))}
          </div>
          {!loading && Object.keys(categoryTotals).length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5">
              <p className="text-sm font-medium text-slate-200">No expenses yet</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Start logging to unlock category insights and better safe-to-spend.
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="shrink-0 text-base font-semibold text-slate-100">Recent</h2>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {expenses.slice(0, 20).map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between gap-3 balnced-row rounded-xl px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{expense.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {expense.category ?? "Other"} · {formatDate(expense.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    {formatMoney(Number(expense.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExpense(expense.id)}
                    className="rounded-lg bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-900/50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!loading && expenses.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5">
              <p className="text-sm font-medium text-slate-200">No expenses logged</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Add one with the form to the left. Recent entries show here.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}