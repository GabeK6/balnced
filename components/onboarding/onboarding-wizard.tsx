"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { billPaidFields } from "@/lib/bill-paid-fields";
import {
  getDaysUntil,
  getMonthlyPay,
  getPaychecksPerYear,
  getRecurringPaydays,
  formatDate,
  formatMoney,
  saveUserGoals,
  type Budget,
} from "@/lib/dashboard-data";
import { getSafeToSpendStatus } from "@/lib/financial-status";
import { markOnboardingComplete } from "@/lib/onboarding-state";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type BillDraft,
  type OnboardingDraftV1,
} from "@/lib/onboarding-draft";
import { EASE_OUT } from "@/components/motion/overview-variants";
import BalncedLogo from "@/components/brand/balnced-logo";

const STEPS = 4;
const inputClass = "balnced-input";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

function newBillRow(): BillDraft {
  return { id: crypto.randomUUID(), name: "", amount: "", due: "" };
}

function buildRecommendation(
  safeToSpend: number,
  dailyLimit: number,
  status: ReturnType<typeof getSafeToSpendStatus>
): string {
  if (safeToSpend <= 0) {
    return "Focus on must-pay bills first—even small cuts free up breathing room before payday.";
  }
  if (status.status === "tight" || status.status === "overspending") {
    return "Keep discretionary spending light until your next paycheck lands.";
  }
  if (dailyLimit > 0 && dailyLimit < 25) {
    return "Your daily limit is modest—pace optional spending and log expenses so the number stays trustworthy.";
  }
  return "You’re in solid shape—use your daily limit as a steady rhythm until payday.";
}

function draftFromState(args: {
  step: number;
  balance: string;
  payType: "salary" | "hourly";
  payFrequency: "weekly" | "biweekly" | "twice_monthly" | "monthly";
  paycheck: string;
  hourlyRate: string;
  hoursWorked: string;
  nextPayday: string;
  billRows: BillDraft[];
  goalName: string;
  goalAmount: string;
  savePercent: string;
}): OnboardingDraftV1 {
  return {
    version: 1,
    step: args.step,
    balance: args.balance,
    payType: args.payType,
    payFrequency: args.payFrequency,
    paycheck: args.paycheck,
    hourlyRate: args.hourlyRate,
    hoursWorked: args.hoursWorked,
    nextPayday: args.nextPayday,
    billRows: args.billRows,
    goalName: args.goalName,
    goalAmount: args.goalAmount,
    savePercent: args.savePercent,
  };
}

export function OnboardingWizard() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const [balance, setBalance] = useState("");
  const [payType, setPayType] = useState<"salary" | "hourly">("salary");
  const [payFrequency, setPayFrequency] = useState<
    "weekly" | "biweekly" | "twice_monthly" | "monthly"
  >("biweekly");
  const [paycheck, setPaycheck] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [nextPayday, setNextPayday] = useState("");
  const [billRows, setBillRows] = useState<BillDraft[]>(() => [newBillRow()]);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [savePercent, setSavePercent] = useState("");

  const [preview, setPreview] = useState<{
    safeToSpend: number;
    dailyLimit: number;
    nextPaydayLabel: string;
    status: ReturnType<typeof getSafeToSpendStatus>;
    recommendation: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const d = loadOnboardingDraft(user.id);
      if (d && !cancelled) {
        setStep(Math.min(Math.max(0, d.step), STEPS - 1));
        setBalance(d.balance);
        setPayType(d.payType);
        setPayFrequency(d.payFrequency);
        setPaycheck(d.paycheck);
        setHourlyRate(d.hourlyRate);
        setHoursWorked(d.hoursWorked);
        setNextPayday(d.nextPayday);
        setBillRows(d.billRows?.length ? d.billRows : [newBillRow()]);
        setGoalName(d.goalName);
        setGoalAmount(d.goalAmount);
        setSavePercent(d.savePercent);
      }
      setDraftLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistDraft(currentStep: number) {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      saveOnboardingDraft(
        user.id,
        draftFromState({
          step: currentStep,
          balance,
          payType,
          payFrequency,
          paycheck,
          hourlyRate,
          hoursWorked,
          nextPayday,
          billRows,
          goalName,
          goalAmount,
          savePercent,
        })
      );
    })();
  }

  const paychecksPerYear = getPaychecksPerYear(payFrequency);

  const calculatedHourlyPaycheck = useMemo(() => {
    const rate = Number(hourlyRate || 0);
    const hours = Number(hoursWorked || 0);
    return rate * hours;
  }, [hourlyRate, hoursWorked]);

  const effectivePaycheck = payType === "hourly" ? calculatedHourlyPaycheck : Number(paycheck || 0);

  const derivedAnnual = useMemo(() => {
    if (!effectivePaycheck || !paychecksPerYear) return 0;
    return Math.round(effectivePaycheck * paychecksPerYear);
  }, [effectivePaycheck, paychecksPerYear]);

  const upcomingPaydaysPreview = useMemo(() => {
    if (!nextPayday) return [];
    return getRecurringPaydays(nextPayday, payFrequency, 3);
  }, [nextPayday, payFrequency]);

  function handleAnnualChange(annualInput: string) {
    if (annualInput.trim() === "") {
      setPaycheck("");
      return;
    }
    const annual = Number(annualInput);
    if (Number.isNaN(annual) || !paychecksPerYear) return;
    setPaycheck(String(Math.round((annual / paychecksPerYear) * 100) / 100));
  }

  function canContinue(s: number): boolean {
    if (s === 0) {
      if (balance.trim() === "" || Number.isNaN(Number(balance))) return false;
      if (payType === "salary") {
        if (effectivePaycheck <= 0) return false;
      } else if (calculatedHourlyPaycheck <= 0) return false;
      return nextPayday.trim() !== "";
    }
    if (s === 1) {
      const filled = billRows.filter((r) => r.name.trim() && r.amount && r.due);
      const anyPartial = billRows.some((r) => {
        const n = r.name.trim();
        const has = (n ? 1 : 0) + (r.amount ? 1 : 0) + (r.due ? 1 : 0);
        return has > 0 && has < 3;
      });
      if (anyPartial) return false;
      for (const r of filled) {
        if (Number(r.amount) <= 0) return false;
        if (nextPayday && r.due > nextPayday) return false;
      }
      return true;
    }
    if (s === 2) {
      return goalName.trim().length > 0 && Number(goalAmount) > 0;
    }
    if (s === 3) {
      if (!savePercent.trim()) return true;
      const p = Number(savePercent);
      return !Number.isNaN(p) && p >= 0 && p <= 100;
    }
    return true;
  }

  async function persistBudgetRow(userId: string): Promise<boolean> {
    const basePayload = {
      user_id: userId,
      balance: Number(balance),
      pay_type: payType,
      pay_frequency: payFrequency,
      paycheck: effectivePaycheck,
      hourly_rate: payType === "hourly" ? Number(hourlyRate || 0) : null,
      hours_worked: payType === "hourly" ? Number(hoursWorked || 0) : null,
      next_payday: nextPayday,
    };

    const existing = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const budgetSave = existing.data?.id
      ? await supabase.from("budgets").update(basePayload).eq("id", existing.data.id).eq("user_id", userId)
      : await supabase.from("budgets").insert(basePayload);

    if (budgetSave.error) {
      console.error(budgetSave.error);
      alert(budgetSave.error.message || "Could not save income.");
      return false;
    }
    return true;
  }

  async function handleContinueFromIncome() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setSaving(true);
    try {
      const ok = await persistBudgetRow(user.id);
      if (!ok) return;
      persistDraft(1);
      setStep(1);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const okBudget = await persistBudgetRow(user.id);
      if (!okBudget) return;

      const filledBills = billRows.filter((r) => r.name.trim() && r.amount && r.due);
      for (const r of filledBills) {
        const { error } = await supabase.from("bills").insert({
          user_id: user.id,
          name: r.name.trim(),
          amount: Number(r.amount),
          due_date: r.due,
          archived: false,
          ...billPaidFields(false),
        });
        if (error) {
          console.error(error);
          alert(error.message || "Could not save a bill.");
          return;
        }
      }

      const sp = savePercent.trim() === "" ? 0 : Math.min(100, Math.max(0, Number(savePercent)));
      const savePctRounded = Math.round(sp * 10) / 10;

      saveUserGoals(user.id, {
        retirement_age: 65,
        savings_goals: [
          {
            id: "onboarding-1",
            name: goalName.trim(),
            amount: Number(goalAmount),
            priority: 1,
          },
        ],
        save_percent: savePctRounded > 0 ? savePctRounded : undefined,
      });

      const mockBudget: Budget = {
        balance: Number(balance),
        paycheck: effectivePaycheck,
        next_payday: nextPayday,
        pay_type: payType,
        pay_frequency: payFrequency,
        hourly_rate: payType === "hourly" ? Number(hourlyRate || 0) : null,
        hours_worked: payType === "hourly" ? Number(hoursWorked || 0) : null,
      };

      const billsTotal = filledBills.reduce((s, r) => s + Number(r.amount), 0);
      const monthlyPay = getMonthlyPay(mockBudget);
      const monthlySavings =
        monthlyPay > 0 && savePctRounded > 0 ? monthlyPay * (savePctRounded / 100) : 0;
      const goalsToSubtract = monthlySavings;
      const safeToSpend = Math.max(0, Number(balance) - billsTotal - goalsToSubtract);
      const daysUntilPayday = getDaysUntil(nextPayday);
      const dailyLimit = daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;
      const status = getSafeToSpendStatus(safeToSpend, dailyLimit, daysUntilPayday);

      setPreview({
        safeToSpend,
        dailyLimit,
        nextPaydayLabel: formatDate(nextPayday),
        status,
        recommendation: buildRecommendation(safeToSpend, dailyLimit, status),
      });

      markOnboardingComplete(user.id);
      clearOnboardingDraft(user.id);
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  const progress = done ? STEPS : step + 1;

  if (!draftLoaded) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="balnced-panel rounded-3xl p-6">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-between gap-4">
          <BalncedLogo
            size="sm"
            href="/"
            className="group transition-opacity hover:opacity-100"
            wordmarkClassName="text-slate-400 transition-colors group-hover:text-emerald-400"
          />
          {!done && (
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Step {Math.min(step + 1, STEPS)} of {STEPS}
            </p>
          )}
        </div>

        <div className="mb-6 h-1 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={false}
            animate={{ width: `${(progress / STEPS) * 100}%` }}
            transition={{ duration: reduce ? 0 : 0.35, ease: EASE_OUT }}
          />
        </div>

        <div className="balnced-panel rounded-3xl p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {done && preview ? (
              <motion.div
                key="success"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h1 className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">You&apos;re set up</h1>
                  <p className="mt-2 text-sm text-slate-400">
                    Here&apos;s a first look at your numbers for this pay period.
                  </p>
                </div>

                <div className="mt-8 space-y-3 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/80 to-slate-950/80 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                      Safe to spend
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-100">
                      {preview.status.label}
                    </span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-white">
                    {formatMoney(preview.safeToSpend)}
                  </p>
                  <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">Daily limit</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">
                        {formatMoney(preview.dailyLimit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">Next payday</p>
                      <p className="mt-1 text-lg font-semibold text-slate-100">{preview.nextPaydayLabel}</p>
                    </div>
                  </div>
                </div>

                <p className="mt-6 rounded-xl border border-white/[0.06] bg-slate-900/40 p-4 text-sm leading-relaxed text-slate-300">
                  {preview.recommendation}
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <a
                    href="/dashboard"
                    className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(5,150,105,0.4)] transition hover:bg-emerald-500 sm:flex-none"
                  >
                    Go to Overview
                  </a>
                  <a
                    href="/bills"
                    className="inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-center text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] sm:flex-none"
                  >
                    Refine bills
                  </a>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={step}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -12 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
              >
                {step === 0 && (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-500/90">
                      Step 1 · Income
                    </p>
                    <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">How you earn &amp; when you get paid</h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      About a minute—balance, paycheck, and next payday so we can pace spending.
                    </p>

                    <div className="mt-6 space-y-6">
                      <div>
                        <label className={labelClass}>Current checking balance</label>
                        <input
                          type="number"
                          step="0.01"
                          value={balance}
                          onChange={(e) => setBalance(e.target.value)}
                          placeholder="e.g. 2400"
                          className={inputClass}
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
                                ? "bg-emerald-600 text-white"
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
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            Hourly
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Pay frequency</label>
                        <select
                          value={payFrequency}
                          onChange={(e) =>
                            setPayFrequency(
                              e.target.value as "weekly" | "biweekly" | "twice_monthly" | "monthly"
                            )
                          }
                          className={inputClass}
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
                            <label className={labelClass}>Take-home per paycheck</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={paycheck}
                              onChange={(e) => setPaycheck(e.target.value)}
                              placeholder="e.g. 1850"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Or annual take-home (optional)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={derivedAnnual > 0 ? derivedAnnual : ""}
                              onChange={(e) => handleAnnualChange(e.target.value)}
                              className={inputClass}
                              placeholder="e.g. 62000"
                            />
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
                              className={inputClass}
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
                              className={inputClass}
                            />
                          </div>
                          <p className="text-sm text-slate-400">
                            Expected paycheck:{" "}
                            <span className="font-semibold text-slate-200">
                              {formatMoney(calculatedHourlyPaycheck)}
                            </span>
                          </p>
                        </>
                      )}

                      <div>
                        <label className={labelClass}>Next payday</label>
                        <input
                          type="date"
                          value={nextPayday}
                          onChange={(e) => setNextPayday(e.target.value)}
                          className={inputClass}
                        />
                        {upcomingPaydaysPreview.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Then roughly:{" "}
                            {upcomingPaydaysPreview
                              .slice(1)
                              .map((d) => formatDate(d))
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-500/90">
                      Step 2 · Bills
                    </p>
                    <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Recurring bills</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      Add what&apos;s due before your next payday—or leave rows empty and add later.
                    </p>
                    <div className="mt-6 space-y-4">
                      {billRows.map((row) => (
                        <div key={row.id} className="balnced-row rounded-2xl p-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className={labelClass}>Name</label>
                              <input
                                value={row.name}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBillRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, name: v } : r))
                                  );
                                }}
                                placeholder="Rent"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Amount</label>
                              <input
                                type="number"
                                step="0.01"
                                value={row.amount}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBillRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, amount: v } : r))
                                  );
                                }}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Due</label>
                              <input
                                type="date"
                                value={row.due}
                                max={nextPayday || undefined}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBillRows((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, due: v } : r))
                                  );
                                }}
                                className={inputClass}
                              />
                            </div>
                          </div>
                          {billRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBillRows((prev) => prev.filter((r) => r.id !== row.id))}
                              className="mt-3 text-xs font-medium text-rose-400 hover:text-rose-300"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setBillRows((prev) => [...prev, newBillRow()])}
                        className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        + Add another bill
                      </button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-500/90">
                      Step 3 · Goals
                    </p>
                    <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Your first savings goal</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      Balnced uses goals to prioritize savings. Add one to continue—you can add more later.
                    </p>
                    <div className="mt-6 space-y-4">
                      <div>
                        <label className={labelClass}>Goal name</label>
                        <input
                          value={goalName}
                          onChange={(e) => setGoalName(e.target.value)}
                          placeholder="e.g. Emergency fund"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Target amount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={goalAmount}
                          onChange={(e) => setGoalAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-500/90">
                      Step 4 · Preferences
                    </p>
                    <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Savings rate (optional)</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      Roughly what percent of take-home do you want to allocate toward savings goals? You can change this anytime.
                    </p>
                    <div className="mt-6">
                      <label className={labelClass}>Save % of monthly take-home</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={savePercent}
                        onChange={(e) => setSavePercent(e.target.value)}
                        placeholder="e.g. 10 (leave empty for 0)"
                        className={inputClass}
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        This reduces &quot;safe to spend&quot; the same way as the Goals page.
                      </p>
                    </div>
                  </>
                )}

                <div className="mt-8 flex flex-wrap gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const ns = Math.max(0, step - 1);
                        setStep(ns);
                        persistDraft(ns);
                      }}
                      className="min-h-[2.75rem] rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.07]"
                    >
                      Back
                    </button>
                  )}
                  <div className="flex flex-1 justify-end">
                    {step < STEPS - 1 ? (
                      <button
                        type="button"
                        disabled={!canContinue(step) || saving}
                        onClick={() => {
                          if (step === 0) {
                            void handleContinueFromIncome();
                            return;
                          }
                          if (!canContinue(step)) return;
                          persistDraft(step + 1);
                          setStep((s) => s + 1);
                        }}
                        className="min-h-[2.75rem] rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {step === 0 && saving ? "Saving…" : "Continue"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving || !canContinue(step)}
                        onClick={() => void handleFinish()}
                        className="min-h-[2.75rem] rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Finish setup"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          You can edit everything later in Income &amp; balance, Bills, and Goals.
        </p>
      </div>
    </main>
  );
}
