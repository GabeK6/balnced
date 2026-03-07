"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatDate,
  formatMoney,
  Budget,
  Bill,
  toDateOnly,
} from "@/lib/dashboard-data";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type ProjectionPoint = {
  date: string;
  title: string;
  change: number;
  balance: number;
};

export default function ProjectionPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
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

  const projectionData = useMemo(() => {
    if (!budget) return [];
    const points: ProjectionPoint[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let runningBalance = Number(budget.balance);

    points.push({
      date: toDateOnly(today),
      title: "Today",
      change: 0,
      balance: runningBalance,
    });

    const sortedBills = [...upcomingBills].sort((a, b) =>
      a.due_date.localeCompare(b.due_date)
    );

    for (const bill of sortedBills) {
      runningBalance -= Number(bill.amount);
      points.push({
        date: bill.due_date,
        title: bill.name,
        change: -Number(bill.amount),
        balance: runningBalance,
      });
    }

    points.push({
      date: budget.next_payday,
      title: "Payday",
      change: Number(budget.paycheck),
      balance: runningBalance + Number(budget.paycheck),
    });

    return points;
  }, [budget, upcomingBills]);

  const projectedBeforePayday =
    projectionData.length > 1
      ? projectionData[projectionData.length - 2]?.balance ?? 0
      : 0;

  const projectedAfterPayday =
    projectionData.length > 0
      ? projectionData[projectionData.length - 1]?.balance ?? 0
      : 0;

  return (
    <DashboardShell
      title="Projection"
      subtitle="See where your balance is headed before the next paycheck."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Projected Before Payday</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatMoney(projectedBeforePayday)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Projected After Payday</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatMoney(projectedAfterPayday)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Upcoming Bills Count</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {upcomingBills.length}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Projection Chart</h2>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="balance" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>

          <div className="mt-4 space-y-3">
            {projectionData.map((item, index) => (
              <div
                key={`${item.date}-${item.title}-${index}`}
                className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{formatDate(item.date)}</p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="font-semibold text-slate-900">
                    {item.change >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(item.change))}
                  </p>
                  <p className="text-sm text-slate-500">
                    Balance: {formatMoney(item.balance)}
                  </p>
                </div>
              </div>
            ))}

            {!loading && projectionData.length === 0 && (
              <p className="text-slate-500">No projection data yet.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}