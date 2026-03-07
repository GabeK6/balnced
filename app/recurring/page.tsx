"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatMoney,
  RecurringBill,
  generateRecurringBills,
} from "@/lib/dashboard-data";
import { supabase } from "@/lib/supabase";

export default function RecurringPage() {
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] =
    useState<RecurringBill["frequency"]>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setRecurringBills(data.recurringBills);
      setLoading(false);
    }
    load();
  }, []);

  async function addRecurringBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const payload = {
      user_id: user.id,
      name,
      amount: Number(amount),
      category: category || null,
      frequency,
      day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
      day_of_week:
        frequency === "weekly" || frequency === "biweekly"
          ? Number(dayOfWeek)
          : null,
      active: true,
    };

    const { data, error } = await supabase
      .from("recurring_bills")
      .insert(payload)
      .select("*")
      .single();

    if (error) return alert("Could not save recurring bill.");

    const updated = [data as RecurringBill, ...recurringBills];
    setRecurringBills(updated);
    await generateRecurringBills(user.id, updated);

    setName("");
    setAmount("");
    setCategory("");
    setFrequency("monthly");
    setDayOfMonth("");
    setDayOfWeek("1");
  }

  async function deleteRecurringBill(id: string) {
    const { error } = await supabase.from("recurring_bills").delete().eq("id", id);
    if (error) return alert("Could not delete recurring bill.");
    setRecurringBills((prev) => prev.filter((bill) => bill.id !== id));
  }

  return (
    <DashboardShell
      title="Recurring Bills"
      subtitle="Create repeating bills that auto-generate for future due dates."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Add Recurring Bill
          </h2>

          <form onSubmit={addRecurringBill} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Bill name"
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

            <input
              type="text"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
            />

            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurringBill["frequency"])
              }
              className="w-full rounded-2xl border border-slate-200 p-3"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>

            {frequency === "monthly" ? (
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Day of month"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 p-3"
                required
              />
            ) : (
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 p-3"
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            )}

            <button className="rounded-2xl bg-emerald-500 px-5 py-3 font-medium text-white">
              Add Recurring Bill
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Your Templates</h2>

          <div className="mt-4 space-y-3">
            {recurringBills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{bill.name}</p>
                  <p className="text-sm text-slate-500">
                    {bill.frequency === "monthly"
                      ? `Monthly on day ${bill.day_of_month}`
                      : `${bill.frequency} • day ${bill.day_of_week}`}
                    {bill.category ? ` • ${bill.category}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">
                    {formatMoney(Number(bill.amount))}
                  </p>
                  <button
                    onClick={() => deleteRecurringBill(bill.id)}
                    className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!loading && recurringBills.length === 0 && (
              <p className="text-slate-500">No recurring bills yet.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}