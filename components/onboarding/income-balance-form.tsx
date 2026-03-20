"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRecurringPaydays, getPaychecksPerYear } from "@/lib/dashboard-data";

type BudgetRow = {
  id: string;
  balance: number | null;
  paycheck: number | null;
  next_payday: string | null;
  pay_type: "salary" | "hourly" | null;
  pay_frequency: "weekly" | "biweekly" | "twice_monthly" | "monthly" | null;
  hourly_rate: number | null;
  hours_worked: number | null;
};

const inputClass = "balnced-input";
const labelClass = "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5";

/**
 * Full “Income & balance” editor (returning users). First-run users see `OnboardingWizard` instead.
 */
export default function IncomeBalanceForm() {
  const router = useRouter();

  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [balance, setBalance] = useState("");
  const [payType, setPayType] = useState<"salary" | "hourly">("salary");
  const [payFrequency, setPayFrequency] = useState<
    "weekly" | "biweekly" | "twice_monthly" | "monthly"
  >("biweekly");
  const [paycheck, setPaycheck] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [nextPayday, setNextPayday] = useState("");

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const paychecksPerYear = getPaychecksPerYear(payFrequency);

  const calculatedHourlyPaycheck = useMemo(() => {
    const rate = Number(hourlyRate || 0);
    const hours = Number(hoursWorked || 0);
    if (!rate || !hours) return 0;
    return rate * hours;
  }, [hourlyRate, hoursWorked]);

  const effectivePaycheck = useMemo(() => {
    if (payType === "hourly") return calculatedHourlyPaycheck;
    return Number(paycheck || 0);
  }, [payType, paycheck, calculatedHourlyPaycheck]);

  const derivedAnnual = useMemo(() => {
    if (!effectivePaycheck || !paychecksPerYear) return 0;
    return Math.round(effectivePaycheck * paychecksPerYear);
  }, [effectivePaycheck, paychecksPerYear]);

  const upcomingPaydaysPreview = useMemo(() => {
    if (!nextPayday) return [];
    return getRecurringPaydays(nextPayday, payFrequency, 3);
  }, [nextPayday, payFrequency]);

  useEffect(() => {
    async function loadExistingBudget() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("budgets")
        .select(
          "id, balance, paycheck, next_payday, pay_type, pay_frequency, hourly_rate, hours_worked"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const row = data as BudgetRow;
        setBudgetId(row.id);
        setBalance(String(row.balance ?? ""));
        setNextPayday(row.next_payday ?? "");
        setPayType((row.pay_type as "salary" | "hourly") || "salary");
        setPayFrequency(
          (row.pay_frequency as
            | "weekly"
            | "biweekly"
            | "twice_monthly"
            | "monthly") || "biweekly"
        );
        setPaycheck(String(row.paycheck ?? ""));
        setHourlyRate(String(row.hourly_rate ?? ""));
        setHoursWorked(String(row.hours_worked ?? ""));
      }

      setPageLoading(false);
    }

    loadExistingBudget();
  }, [router]);

  function handlePaycheckChange(value: string) {
    setPaycheck(value);
  }

  function handleAnnualChange(annualInput: string) {
    if (annualInput.trim() === "") {
      setPaycheck("");
      return;
    }
    const annual = Number(annualInput);
    if (Number.isNaN(annual) || !paychecksPerYear) return;
    const newPaycheck = annual / paychecksPerYear;
    setPaycheck(String(Math.round(newPaycheck * 100) / 100));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const basePayload = {
      user_id: user.id,
      balance: Number(balance),
      pay_type: payType,
      pay_frequency: payFrequency,
      paycheck: effectivePaycheck,
      hourly_rate: payType === "hourly" ? Number(hourlyRate || 0) : null,
      hours_worked: payType === "hourly" ? Number(hoursWorked || 0) : null,
      next_payday: nextPayday,
    };

    let result: { data: unknown; error: unknown } | null = null;

    if (budgetId) {
      const updateResult = await supabase
        .from("budgets")
        .update(basePayload)
        .eq("id", budgetId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      result = updateResult;
      if (!updateResult.error && updateResult.data === null) {
        result = {
          data: null,
          error: {
            message: "No budget row found to update.",
            code: "PGRST116",
            details: "The result contains 0 rows",
          },
        };
      }
    } else {
      result = await supabase.from("budgets").insert(basePayload).select("id").single();
      if (
        !result.error &&
        result.data &&
        typeof result.data === "object" &&
        "id" in result.data
      ) {
        setBudgetId((result.data as { id: string }).id);
      }
    }

    setLoading(false);

    const error = result?.error;
    if (error) {
      const err = error as {
        message?: string;
        details?: string;
        code?: string;
        hint?: string;
      };
      const message = err.message || String(error) || "Could not save.";
      console.error("Budget save error:", err.message, err.code, err.details);
      alert(`Could not save: ${message}${err.details ? ` (${err.details})` : ""}`);
      return;
    }

    window.location.href = "/dashboard";
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="balnced-panel rounded-3xl p-5 sm:p-6">
            <p className="text-slate-400">Loading your financial profile…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Overview
            </Link>
            <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Income & balance</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Update your balance, pay setup, pay frequency, and next payday. These values drive
              safe-to-spend, daily limits, projections, retirement defaults, and recommendations.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="balnced-panel rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-100">Financial profile</h2>
            <p className="mt-1 text-xs text-slate-400">Balance, pay type, frequency, income, and next payday.</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5 sm:mt-6">
              <div>
                <label className={labelClass}>Current balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="e.g. 1200"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Pay type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPayType("salary")}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      payType === "salary"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Salary
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayType("hourly")}
                    className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      payType === "hourly"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Hourly
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Pay frequency</label>
                <p className="mb-1.5 text-xs text-slate-400">How often you get paid</p>
                <select
                  value={payFrequency}
                  onChange={(e) =>
                    setPayFrequency(
                      e.target.value as "weekly" | "biweekly" | "twice_monthly" | "monthly"
                    )
                  }
                  className={inputClass}
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="twice_monthly">Twice per month</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {payType === "salary" ? (
                <>
                  <div>
                    <label className={labelClass}>Amount per paycheck</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paycheck}
                      onChange={(e) => handlePaycheckChange(e.target.value)}
                      placeholder="e.g. 1500"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Annual take-home (estimated)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={derivedAnnual > 0 ? derivedAnnual : ""}
                      onChange={(e) => handleAnnualChange(e.target.value)}
                      placeholder="e.g. 45000"
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Edit either amount; they stay in sync. Stored as per-paycheck.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Hourly rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="e.g. 20"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Hours per pay period</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={hoursWorked}
                      onChange={(e) => setHoursWorked(e.target.value)}
                      placeholder="e.g. 80"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="balnced-row rounded-xl p-4 sm:p-5">
                    <p className="text-xs font-medium text-slate-400">Expected paycheck</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">
                      ${calculatedHourlyPaycheck.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Hourly rate × hours per pay period</p>
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>Next payday</label>
                <input
                  type="date"
                  value={nextPayday}
                  onChange={(e) => setNextPayday(e.target.value)}
                  className={inputClass}
                  required
                />
                {upcomingPaydaysPreview.length > 0 && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Upcoming:{" "}
                    {upcomingPaydaysPreview.map((d) => new Date(d).toLocaleDateString()).join(", ")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[2.75rem] rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-70"
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="min-h-[2.75rem] rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <div className="balnced-panel rounded-3xl p-5 sm:p-6">
              <h3 className="text-base font-semibold text-slate-100">What updates when you save</h3>
              <p className="mt-1 text-xs text-slate-400">Saving here recalculates the following across the app.</p>
              <ul className="mt-4 space-y-3">
                <li className="balnced-row flex gap-3 rounded-xl p-4">
                  <span className="text-emerald-400">●</span>
                  <div>
                    <p className="font-medium text-slate-100">Safe to spend</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Uses your current balance, bills, and expenses to show how much you can spend before the next
                      payday.
                    </p>
                  </div>
                </li>
                <li className="balnced-row flex gap-3 rounded-xl p-4">
                  <span className="text-emerald-400">●</span>
                  <div>
                    <p className="font-medium text-slate-100">Daily spending limit</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Safe-to-spend divided by days until payday so you can pace spending.
                    </p>
                  </div>
                </li>
                <li className="balnced-row flex gap-3 rounded-xl p-4">
                  <span className="text-emerald-400">●</span>
                  <div>
                    <p className="font-medium text-slate-100">Payday projection</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Future payday dates and cash flow views use your pay frequency and next payday.
                    </p>
                  </div>
                </li>
                <li className="balnced-row flex gap-3 rounded-xl p-4">
                  <span className="text-emerald-400">●</span>
                  <div>
                    <p className="font-medium text-slate-100">Retirement planner</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      If you haven’t set a salary there, the Retirement tab will use your annual income from here as
                      the default.
                    </p>
                  </div>
                </li>
                <li className="balnced-row flex gap-3 rounded-xl p-4">
                  <span className="text-emerald-400">●</span>
                  <div>
                    <p className="font-medium text-slate-100">Goals & recommendations</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Savings timeline and AI invest/save suggestions use this income and pay frequency.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="balnced-panel rounded-3xl p-5 sm:p-6">
              <h3 className="text-base font-semibold text-slate-100">Tips</h3>
              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-400">
                <li>• Use your actual current balance for accurate safe-to-spend.</li>
                <li>• Pick the pay frequency that matches your real pay schedule.</li>
                <li>• For hourly work, update hours when they change for better forecasts.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
