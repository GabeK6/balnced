"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatDate,
  formatMoney,
  Bill,
  Budget,
} from "@/lib/dashboard-data";
import { supabase } from "@/lib/supabase";

export default function BillsPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState("");

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setBudget(data.budget);
      setBills(data.bills);
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

  const paidBills = useMemo(
    () => bills.filter((bill) => bill.is_paid && !bill.archived),
    [bills]
  );

  async function addBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("bills")
      .insert({
        user_id: user.id,
        name: billName,
        amount: Number(billAmount),
        due_date: billDate,
        is_paid: false,
        archived: false,
        recurring_bill_id: null,
        is_recurring: false,
      })
      .select("*")
      .single();

    if (error) return alert("Could not save bill.");

    setBills((prev) =>
      [...prev, data as Bill].sort((a, b) => a.due_date.localeCompare(b.due_date))
    );
    setBillName("");
    setBillAmount("");
    setBillDate("");
  }

  async function deleteBill(id: string) {
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) return alert("Could not delete bill.");
    setBills((prev) => prev.filter((bill) => bill.id !== id));
  }

  async function toggleBillPaid(id: string, currentValue: boolean) {
    const { error } = await supabase
      .from("bills")
      .update({ is_paid: !currentValue })
      .eq("id", id);

    if (error) return alert("Could not update bill.");

    setBills((prev) =>
      prev.map((bill) =>
        bill.id === id ? { ...bill, is_paid: !currentValue } : bill
      )
    );
  }

  return (
    <DashboardShell
      title="Bills"
      subtitle="Manage one-time and generated bills in one place."
    >
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Add Bill</h2>

          <form onSubmit={addBill} className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Bill name"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
              required
            />
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3"
              required
            />

            <button className="rounded-2xl bg-emerald-500 px-5 py-3 font-medium text-white">
              Add Bill
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Upcoming Bills</h2>

          <div className="mt-4 space-y-3">
            {upcomingBills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{bill.name}</p>
                  <p className="text-sm text-slate-500">
                    Due {formatDate(bill.due_date)}
                    {bill.is_recurring ? " • Recurring" : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">
                    {formatMoney(Number(bill.amount))}
                  </p>
                  <button
                    onClick={() => toggleBillPaid(bill.id, !!bill.is_paid)}
                    className="rounded-xl bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700"
                  >
                    Mark Paid
                  </button>
                  <button
                    onClick={() => deleteBill(bill.id)}
                    className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!loading && upcomingBills.length === 0 && (
              <p className="text-slate-500">No upcoming bills.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Paid Bills</h2>

        <div className="mt-4 space-y-3">
          {paidBills.map((bill) => (
            <div
              key={bill.id}
              className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{bill.name}</p>
                <p className="text-sm text-slate-500">
                  Due {formatDate(bill.due_date)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">
                  {formatMoney(Number(bill.amount))}
                </p>
                <button
                  onClick={() => toggleBillPaid(bill.id, !!bill.is_paid)}
                  className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-700"
                >
                  Unmark
                </button>
                <button
                  onClick={() => deleteBill(bill.id)}
                  className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!loading && paidBills.length === 0 && (
            <p className="text-slate-500">No paid bills yet.</p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}