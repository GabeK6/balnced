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
      subtitle="Track spending clearly and keep categories organized."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Add Expense</h2>

          <form onSubmit={addExpense} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Expense name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
              required
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
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

            <button className="rounded-2xl bg-emerald-500 px-5 py-3 font-medium text-white">
              Add Expense
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">By Category</h2>

          <div className="mt-4 space-y-3">
            {Object.entries(categoryTotals).map(([key, total]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-2xl bg-slate-50 p-4"
              >
                <p className="font-medium text-slate-900">{key}</p>
                <p className="font-semibold text-slate-900">
                  {formatMoney(Number(total))}
                </p>
              </div>
            ))}

            {!loading && Object.keys(categoryTotals).length === 0 && (
              <p className="text-slate-500">No expenses yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Recent Expenses</h2>

        <div className="mt-4 space-y-3">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{expense.name}</p>
                <p className="text-sm text-slate-500">
                  {expense.category ? `${expense.category} • ` : ""}
                  Added {formatDate(expense.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">
                  {formatMoney(Number(expense.amount))}
                </p>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!loading && expenses.length === 0 && (
            <p className="text-slate-500">No expenses recorded yet.</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}