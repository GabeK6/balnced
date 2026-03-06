"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Budget = {
  balance: number;
  paycheck: number;
  next_payday: string;
};

type Bill = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  is_paid?: boolean;
  archived?: boolean;
};

type Expense = {
  id: string;
  name: string;
  amount: number;
  created_at: string;
  category?: string;
  archived?: boolean;
};

export default function DashboardPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState("");

  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");

  const [insight, setInsight] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: budgetData, error: budgetError } = await supabase
        .from("budgets")
        .select("balance, paycheck, next_payday")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (budgetError) {
        console.log("Budget fetch error:", budgetError.message);
      } else {
        setBudget(budgetData);
      }

      const { data: billsData, error: billsError } = await supabase
        .from("bills")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("due_date", { ascending: true });

      if (billsError) {
        console.log("Bills fetch error:", billsError.message);
      } else {
        setBills((billsData || []) as Bill[]);
      }

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (expensesError) {
        console.log("Expenses fetch error:", expensesError.message);
      } else {
        setExpenses((expensesData || []) as Expense[]);
      }

      setLoading(false);
    }

    loadDashboard();
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

      return (
        !bill.archived &&
        !bill.is_paid &&
        due >= today &&
        due <= payday
      );
    });
  }, [bills, budget]);

  const paidBills = useMemo(() => {
    return bills.filter((bill) => bill.is_paid && !bill.archived);
  }, [bills]);

  const billsTotal = upcomingBills.reduce(
    (sum, bill) => sum + Number(bill.amount),
    0
  );

  const expensesTotal = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const safeToSpend = budget
    ? budget.balance - billsTotal - expensesTotal
    : 0;

  function getDaysUntil(dateString: string) {
    const today = new Date();
    const target = new Date(dateString);

    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffMs = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays < 0 ? 0 : diffDays;
  }

  const daysUntilPayday = budget ? getDaysUntil(budget.next_payday) : 0;

  const dailySpendingLimit =
    daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;

  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = expense.category || "Other";
    acc[category] = (acc[category] || 0) + Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  const chartData = budget
    ? [
        { name: "Balance", value: Number(budget.balance) },
        { name: "Bills", value: billsTotal },
        { name: "Expenses", value: expensesTotal },
        { name: "Remaining", value: safeToSpend },
      ]
    : [];

  useEffect(() => {
    if (!budget) return;

    const largestCategoryEntry = Object.entries(categoryTotals).sort(
      (a, b) => Number(b[1]) - Number(a[1])
    )[0];

    const largestCategory = largestCategoryEntry?.[0];
    const largestCategoryTotal = largestCategoryEntry?.[1];

    let nextInsight = `You have $${safeToSpend.toFixed(
      2
    )} left to safely spend before payday.`;

    if (safeToSpend < 0) {
      nextInsight =
        "You are currently over your safe-to-spend amount. Focus on pausing non-essential spending until your next paycheck.";
    } else if (daysUntilPayday > 0 && dailySpendingLimit < 15) {
      nextInsight = `Your daily spending limit is only $${dailySpendingLimit.toFixed(
        2
      )}. Keep spending tight until payday.`;
    } else if (billsTotal > budget.balance * 0.5) {
      nextInsight =
        "More than half of your current balance is tied up in bills before payday.";
    } else if (largestCategory && largestCategoryTotal) {
      nextInsight = `Your biggest expense category right now is ${largestCategory} at $${Number(
        largestCategoryTotal
      ).toFixed(2)}.`;
    }

    setInsight(nextInsight);
  }, [
    budget,
    safeToSpend,
    dailySpendingLimit,
    billsTotal,
    daysUntilPayday,
    categoryTotals,
  ]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function addBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      return;
    }

    const { data, error } = await supabase
      .from("bills")
      .insert({
        user_id: user.id,
        name: billName,
        amount: Number(billAmount),
        due_date: billDate,
        is_paid: false,
        archived: false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Add bill error:", error.message);
      alert("Could not save bill.");
      return;
    }

    if (data) {
      setBills((prev) =>
        [...prev, data as Bill].sort((a, b) => a.due_date.localeCompare(b.due_date))
      );
    }

    setBillName("");
    setBillAmount("");
    setBillDate("");
  }

  async function deleteBill(id: string) {
    const { error } = await supabase.from("bills").delete().eq("id", id);

    if (error) {
      console.error("Delete bill error:", error.message);
      alert("Could not delete bill.");
      return;
    }

    setBills((prev) => prev.filter((bill) => bill.id !== id));
  }

  async function toggleBillPaid(id: string, currentValue: boolean) {
    const { error } = await supabase
      .from("bills")
      .update({ is_paid: !currentValue })
      .eq("id", id);

    if (error) {
      console.error("Toggle bill paid error:", error.message);
      alert("Could not update bill.");
      return;
    }

    setBills((prev) =>
      prev.map((bill) =>
        bill.id === id ? { ...bill, is_paid: !currentValue } : bill
      )
    );
  }

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      return;
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        name: expenseName,
        amount: Number(expenseAmount),
        category: expenseCategory,
        archived: false,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Add expense error:", error.message);
      alert("Could not save expense.");
      return;
    }

    if (data) {
      setExpenses((prev) => [data as Expense, ...prev]);
    }

    setExpenseName("");
    setExpenseAmount("");
    setExpenseCategory("");
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
      console.error("Delete expense error:", error.message);
      alert("Could not delete expense.");
      return;
    }

    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
  }

  async function resetCycle() {
    const confirmed = window.confirm(
      "Archive all current expenses and all paid bills?"
    );

    if (!confirmed) return;

    const { error: expenseError } = await supabase
      .from("expenses")
      .update({ archived: true })
      .eq("archived", false);

    if (expenseError) {
      console.error("Expense archive error:", expenseError.message);
      alert("Could not archive expenses.");
      return;
    }

    const { error: billError } = await supabase
      .from("bills")
      .update({ archived: true })
      .eq("is_paid", true)
      .eq("archived", false);

    if (billError) {
      console.error("Bill archive error:", billError.message);
      alert("Could not archive paid bills.");
      return;
    }

    setExpenses([]);
    setBills((prev) => prev.filter((bill) => !bill.is_paid));
    alert("Cycle reset complete.");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-4 text-gray-600">Loading your budget...</p>
      </main>
    );
  }

  if (!budget) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-2 text-gray-600">
              No budget found yet.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border px-4 py-2"
          >
            Log Out
          </button>
        </div>

        <Link
          href="/onboarding"
          className="mt-6 inline-block rounded-xl bg-black px-6 py-3 text-white"
        >
          Set Up Budget
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border p-6">
          <h2 className="text-xl font-bold">Balnced</h2>
          <nav className="mt-6 space-y-3 text-sm">
            <a href="#overview" className="block rounded-lg border px-3 py-2">
              Overview
            </a>
            <a href="#bills" className="block rounded-lg border px-3 py-2">
              Bills
            </a>
            <a href="#expenses" className="block rounded-lg border px-3 py-2">
              Expenses
            </a>
            <a href="#insights" className="block rounded-lg border px-3 py-2">
              Insights
            </a>
          </nav>

          <div className="mt-8 space-y-3">
            <Link
              href="/onboarding"
              className="block rounded-xl border px-4 py-2 text-center"
            >
              Edit Budget
            </Link>

            <button
              onClick={resetCycle}
              className="w-full rounded-xl border px-4 py-2"
            >
              Reset Cycle
            </button>

            <button
              onClick={handleLogout}
              className="w-full rounded-xl border px-4 py-2"
            >
              Log Out
            </button>
          </div>
        </aside>

        <section>
          <div className="flex items-center justify-between" id="overview">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Welcome to Balnced. This is your money overview.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Safe to Spend</h2>
              <p className="mt-2 text-3xl font-bold">
                ${safeToSpend.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Current Balance</h2>
              <p className="mt-2 text-3xl font-bold">
                ${Number(budget.balance).toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Paycheck Amount</h2>
              <p className="mt-2 text-3xl font-bold">
                ${Number(budget.paycheck).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Bills Before Payday</h2>
              <p className="mt-2 text-2xl font-bold">
                ${billsTotal.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Total Expenses</h2>
              <p className="mt-2 text-2xl font-bold">
                ${expensesTotal.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border p-6">
              <h2 className="text-sm text-gray-500">Next Payday</h2>
              <p className="mt-2 text-2xl font-bold">
                {formatDate(budget.next_payday)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border p-6">
            <h2 className="text-sm text-gray-500">Daily Spending Limit</h2>
            <p className="mt-2 text-3xl font-bold">
              ${dailySpendingLimit.toFixed(2)}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Based on {daysUntilPayday} day(s) until payday.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Budget Overview</h2>
            <p className="mt-2 text-gray-600">
              See how your money is split right now.
            </p>

            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border p-6" id="insights">
            <h2 className="text-xl font-semibold">AI Insight</h2>
            <p className="mt-2 text-gray-600">{insight}</p>
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border p-6" id="bills">
              <h2 className="text-xl font-semibold">Add a Bill</h2>
              <p className="mt-2 text-gray-600">
                Add bills due before your next payday.
              </p>

              <form onSubmit={addBill} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Bill name"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="w-full rounded-xl border p-3"
                  required
                />

                <input
                  type="number"
                  placeholder="Amount"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="w-full rounded-xl border p-3"
                  required
                />

                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full rounded-xl border p-3"
                  required
                />

                <button
                  type="submit"
                  className="rounded-xl bg-black px-6 py-3 text-white"
                >
                  Add Bill
                </button>
              </form>
            </div>

            <div className="rounded-2xl border p-6" id="expenses">
              <h2 className="text-xl font-semibold">Add an Expense</h2>
              <p className="mt-2 text-gray-600">
                Track spending as it happens.
              </p>

              <form onSubmit={addExpense} className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Expense name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="w-full rounded-xl border p-3"
                  required
                />

                <input
                  type="number"
                  placeholder="Amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-xl border p-3"
                  required
                />

                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full rounded-xl border p-3"
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
                  className="rounded-xl bg-black px-6 py-3 text-white"
                >
                  Add Expense
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Expense Categories</h2>

            {Object.keys(categoryTotals).length === 0 ? (
              <p className="mt-2 text-gray-600">No expense categories yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {Object.entries(categoryTotals).map(([category, total]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <p>{category}</p>
                    <p className="font-semibold">
                      ${Number(total).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Upcoming Bills</h2>

            {upcomingBills.length === 0 ? (
              <p className="mt-2 text-gray-600">No bills due before payday.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <p className="text-sm text-gray-600">
                        Due {formatDate(bill.due_date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        ${Number(bill.amount).toFixed(2)}
                      </p>

                      <button
                        onClick={() => toggleBillPaid(bill.id, !!bill.is_paid)}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Mark Paid
                      </button>

                      <button
                        onClick={() => deleteBill(bill.id)}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Paid Bills</h2>

            {paidBills.length === 0 ? (
              <p className="mt-2 text-gray-600">No paid bills yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {paidBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{bill.name}</p>
                      <p className="text-sm text-gray-600">
                        Due {formatDate(bill.due_date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        ${Number(bill.amount).toFixed(2)}
                      </p>

                      <button
                        onClick={() => toggleBillPaid(bill.id, !!bill.is_paid)}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Unmark
                      </button>

                      <button
                        onClick={() => deleteBill(bill.id)}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border p-6">
            <h2 className="text-xl font-semibold">Recent Expenses</h2>

            {expenses.length === 0 ? (
              <p className="mt-2 text-gray-600">No expenses recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between rounded-xl border p-4"
                  >
                    <div>
                      <p className="font-medium">{expense.name}</p>
                      <p className="text-sm text-gray-600">
                        {expense.category ? `${expense.category} • ` : ""}
                        Added {formatDate(expense.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        ${Number(expense.amount).toFixed(2)}
                      </p>

                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="rounded-lg border px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}