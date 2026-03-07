"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function OnboardingPage() {
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

  const calculatedHourlyPaycheck = useMemo(() => {
    const rate = Number(hourlyRate || 0);
    const hours = Number(hoursWorked || 0);

    if (!rate || !hours) return 0;
    return rate * hours;
  }, [hourlyRate, hoursWorked]);

  const finalPaycheck = useMemo(() => {
    if (payType === "hourly") return calculatedHourlyPaycheck;
    return Number(paycheck || 0);
  }, [payType, paycheck, calculatedHourlyPaycheck]);

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
        .single();

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

    const payload = {
      user_id: user.id,
      balance: Number(balance),
      pay_type: payType,
      pay_frequency: payFrequency,
      paycheck: finalPaycheck,
      hourly_rate: payType === "hourly" ? Number(hourlyRate || 0) : null,
      hours_worked: payType === "hourly" ? Number(hoursWorked || 0) : null,
      next_payday: nextPayday,
      updated_at: new Date().toISOString(),
    };

    let error = null;

    if (budgetId) {
      const result = await supabase
        .from("budgets")
        .update(payload)
        .eq("id", budgetId)
        .eq("user_id", user.id);

      error = result.error;
    } else {
      const result = await supabase.from("budgets").insert(payload).select("id").single();

      error = result.error;

      if (!result.error && result.data) {
        setBudgetId(result.data.id);
      }
    }

    setLoading(false);

    if (error) {
      alert("Could not save budget.");
      return;
    }

    router.push("/dashboard");
  }

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-slate-600">Loading your budget settings...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Balnced
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
                Manage your budget
              </h1>
              <p className="mt-3 max-w-2xl text-slate-500">
                Keep your money profile updated so Balnced can calculate your
                safe-to-spend, daily limit, and payday planning more accurately.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <p className="text-sm text-slate-500">Track</p>
                <p className="mt-2 font-semibold text-slate-900">Balance</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <p className="text-sm text-slate-500">Plan</p>
                <p className="mt-2 font-semibold text-slate-900">Payday Cycle</p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <p className="text-sm text-slate-500">Power</p>
                <p className="mt-2 font-semibold text-slate-900">Forecasts</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-900">
                Financial profile
              </h2>
              <p className="mt-2 text-slate-500">
                Update the numbers Balnced uses for budgeting and payday planning.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Current Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="1200"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Pay Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayType("salary")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      payType === "salary"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Salary
                  </button>

                  <button
                    type="button"
                    onClick={() => setPayType("hourly")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      payType === "hourly"
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Hourly
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Pay Frequency
                </label>
                <select
                  value={payFrequency}
                  onChange={(e) =>
                    setPayFrequency(
                      e.target.value as
                        | "weekly"
                        | "biweekly"
                        | "twice_monthly"
                        | "monthly"
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="twice_monthly">Twice Monthly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {payType === "salary" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Paycheck Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paycheck}
                    onChange={(e) => setPaycheck(e.target.value)}
                    placeholder="1500"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    required
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="20"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Hours Worked This Pay Period
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={hoursWorked}
                      onChange={(e) => setHoursWorked(e.target.value)}
                      placeholder="80"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      required
                    />
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                    <p className="text-sm text-slate-500">Expected Paycheck</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                      ${calculatedHourlyPaycheck.toFixed(2)}
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Next Payday
                </label>
                <input
                  type="date"
                  value={nextPayday}
                  onChange={(e) => setNextPayday(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Saving..." : "Save Budget"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Back to Dashboard
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 text-white shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-100">
                Why this matters
              </p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">
                Better inputs = better money guidance
              </h3>
              <p className="mt-4 leading-7 text-emerald-50">
                Balnced uses your balance, pay structure, payday frequency, and
                next paycheck to power safe-to-spend and timeline projections.
              </p>
            </div>

            <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
              <h3 className="text-xl font-semibold text-slate-900">
                What updates after saving
              </h3>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Safe to Spend</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Recalculates using your current balance, bills, and expenses.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Daily Limit</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Adjusts based on how many days remain until payday.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Payday Planning</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Sets up smarter recurring paycheck forecasting for later.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
              <h3 className="text-xl font-semibold text-slate-900">
                Coming soon
              </h3>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Big Purchase Goals</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Plan for a car, house, gaming PC, or other major purchase.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Savings Timeline</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Get a realistic estimate for when you can afford each goal.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-medium text-slate-900">Spending Guidance</p>
                  <p className="mt-1 text-sm text-slate-500">
                    See how everyday spending affects your larger goals.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
              <h3 className="text-xl font-semibold text-slate-900">
                Quick tips
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li>Use your real current balance, not a rough estimate.</li>
                <li>Choose the pay type that matches how you actually get paid.</li>
                <li>For hourly work, update hours each pay period for better forecasts.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}