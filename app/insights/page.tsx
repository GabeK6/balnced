"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  loadUserGoals,
  getMonthlyPay,
  Budget,
  Bill,
  Expense,
  RecurringBill,
  getDaysUntil,
  formatMoney,
  getNextPayday,
  getExpectedPaycheck,
} from "@/lib/dashboard-data";
import { getDashboardBillsBeforePayday } from "@/lib/recurring-bill-occurrences";
import { getSafeToSpendStatus } from "@/lib/financial-status";
import StatusBadge from "@/components/dashboard/status-badge";

type StructuredGuidance = {
  status: string;
  actions: string[];
  nextEvent: string;
  optionalOptimization: string | null;
};

export default function InsightsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [guidance, setGuidance] = useState<StructuredGuidance | null>(null);
  const [loading, setLoading] = useState(true);
  const [guidanceLoading, setGuidanceLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setUserId(data.user.id);
      setBudget(data.budget);
      setBills(data.bills);
      setRecurringBills(data.recurringBills);
      setExpenses(data.expenses);
      setLoading(false);
    }
    load();
  }, []);

  const nextPayday = getNextPayday(budget);
  const expectedPaycheck = getExpectedPaycheck(budget);
  const monthlyPay = getMonthlyPay(budget);

  const paydayForBills = nextPayday ?? budget?.next_payday ?? null;

  const upcomingBills = useMemo(() => {
    if (!budget) return [];
    return getDashboardBillsBeforePayday(
      recurringBills,
      bills,
      paydayForBills,
      new Date()
    );
  }, [budget, bills, recurringBills, paydayForBills]);

  const billsTotal = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const currentBalance = budget ? Number(budget.balance) - expensesTotal : 0;
  const safeToSpend = Math.max(0, currentBalance - billsTotal);
  const daysUntilPayday = nextPayday ? getDaysUntil(nextPayday) : 0;
  const dailySpendingLimit =
    daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;

  const goals = userId ? loadUserGoals(userId) : null;
  const investPercent = goals?.invest_percent ?? 0;
  const savePercent = goals?.save_percent ?? 0;
  const monthlyRetirementContribution =
    monthlyPay > 0 && investPercent > 0
      ? Math.round((monthlyPay * investPercent) / 100)
      : 0;

  const safeToSpendStatus = getSafeToSpendStatus(
    safeToSpend,
    dailySpendingLimit,
    daysUntilPayday
  );

  const payloadKey = useMemo(
    () =>
      JSON.stringify({
        currentBalance,
        safeToSpend,
        billsTotal,
        daysUntilPayday,
        dailySpendingLimit,
        nextPayday: nextPayday ?? "",
        expectedPaycheck,
        upcomingBillsCount: upcomingBills.length,
        investPercent,
        savePercent,
      }),
    [
      currentBalance,
      safeToSpend,
      billsTotal,
      daysUntilPayday,
      dailySpendingLimit,
      nextPayday,
      expectedPaycheck,
      upcomingBills.length,
      investPercent,
      savePercent,
    ]
  );

  async function refreshGuidance() {
    if (!budget) return;

    setGuidanceLoading(true);
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: currentBalance,
          safeToSpend,
          billsTotal,
          expensesTotal: expensesTotal,
          dailySpendingLimit,
          nextPayday: nextPayday ?? budget?.next_payday ?? "",
          daysUntilPayday,
          expectedPaycheck,
          upcomingBills: upcomingBills.map((b) => ({
            name: b.name,
            amount: Number(b.amount),
            due_date: b.due_date,
          })),
          investPercent,
          savePercent,
          monthlyRetirementContribution,
        }),
      });

      const data = await response.json();
      setGuidance({
        status: data.status ?? "Unable to load guidance.",
        actions: Array.isArray(data.actions) ? data.actions : [],
        nextEvent: data.nextEvent ?? "",
        optionalOptimization: data.optionalOptimization ?? null,
      });
    } catch {
      setGuidance({
        status: "Could not load guidance.",
        actions: ["Try again in a moment."],
        nextEvent: "",
        optionalOptimization: null,
      });
    } finally {
      setGuidanceLoading(false);
    }
  }

  useEffect(() => {
    if (!budget) return;
    refreshGuidance();
  }, [payloadKey, budget]);

  return (
    <DashboardShell
      title="Insights"
      subtitle="Status and next steps from your balance, bills, and payday."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="grid h-full min-h-0 gap-4 sm:gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-slate-100">
                Your guidance
              </h2>
              <StatusBadge status={safeToSpendStatus.status} label={safeToSpendStatus.label} />
            </div>
            <button
              type="button"
              onClick={refreshGuidance}
              disabled={guidanceLoading}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {guidanceLoading ? "Updating…" : "Refresh"}
            </button>
          </div>

          <div className="mt-5 space-y-3 overflow-y-auto pr-1">
            {guidance && (
              <>
                <section className="balnced-row rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base" aria-hidden>
                      📍
                    </span>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </h3>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug text-slate-100">
                    {guidance.status}
                  </p>
                </section>

                {guidance.actions.length > 0 && (
                  <section className="balnced-row rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base" aria-hidden>
                        ✓
                      </span>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </h3>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {guidance.actions.map((action, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-sm leading-relaxed text-slate-300"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="balnced-row rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base" aria-hidden>
                      📅
                    </span>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Next event
                    </h3>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug text-slate-100">
                    {guidance.nextEvent}
                  </p>
                </section>

                {guidance.optionalOptimization && (
                  <section className="rounded-2xl border border-amber-500/25 bg-amber-950/25 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base" aria-hidden>
                        💡
                      </span>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Optional optimization
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-amber-900 dark:text-amber-100">
                      {guidance.optionalOptimization}
                    </p>
                  </section>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-100">
            Snapshot
          </h2>

          <div className="mt-4 space-y-3">
            <div className="balnced-row rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Safe to spend
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                {formatMoney(safeToSpend)}
              </p>
            </div>

            <div className="balnced-row rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Bills before payday
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                {formatMoney(billsTotal)}
              </p>
            </div>

            <div className="balnced-row rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total expenses
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                {formatMoney(expensesTotal)}
              </p>
            </div>

            <div className="balnced-row rounded-2xl p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Daily limit
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                {formatMoney(dailySpendingLimit)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
