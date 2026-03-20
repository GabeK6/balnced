"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  loadUserGoals,
  getSavingsGoalTimelines,
  formatDate,
  formatMoney,
  formatDateMonthYear,
  getDaysUntil,
  getExpectedPaycheck,
  getMonthlyPay,
  getNextPayday,
  getAnnualPay,
  Budget,
  Bill,
  Expense,
  RecurringBill,
} from "@/lib/dashboard-data";
import { getSafeToSpendStatus } from "@/lib/financial-status";
import { runProjection, type RetirementProfile } from "@/lib/retirement-projection";
import { legacyToAccounts } from "@/lib/retirement-accounts";
import { supabase } from "@/lib/supabase";
import { getDashboardBillsBeforePayday } from "@/lib/recurring-bill-occurrences";
import {
  OverviewGlassStat,
  OverviewRetirementHero,
  OverviewSafeToSpendHero,
  OverviewWhatToDoNext,
  getInsightAccent,
} from "@/components/dashboard/overview-premium";
import { MotionLink } from "@/components/motion/motion-link";
import { EASE_OUT, fadeUpItem, staggerContainer } from "@/components/motion/overview-variants";

const panelClassName =
  "rounded-3xl border border-white/[0.07] bg-slate-950/40 p-5 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.55)] sm:p-6 md:p-7";

function DashboardOverviewContent() {
  const reduce = useReducedMotion();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [guidance, setGuidance] = useState<{
    status: string;
    actions: string[];
    nextEvent: string;
    optionalOptimization: string | null;
  } | null>(null);
  const [estimatedRetirement, setEstimatedRetirement] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await loadDashboardData();

    if (!data.user) {
      window.location.href = "/login";
      return;
    }

    setUserId(data.user.id);
    setBudget(data.budget);
    setBills(data.bills);
    setExpenses(data.expenses);
    setRecurringBills(data.recurringBills);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get("updated") === "1") {
      loadData();
      window.history.replaceState(null, "", "/dashboard");
    }
  }, [searchParams, loadData]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadData();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadData]);

  useEffect(() => {
    async function loadRetirementEstimate() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !budget) {
        setEstimatedRetirement(null);
        return;
      }
      const { data, error } = await supabase
        .from("retirement_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        setEstimatedRetirement(null);
        return;
      }
      const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
      const accountsFromDb =
        data.retirement_accounts && typeof data.retirement_accounts === "object"
          ? data.retirement_accounts
          : legacyToAccounts(data);

      let profile: RetirementProfile = {
        current_age: n(data.current_age),
        retirement_age: n(data.retirement_age),
        current_salary: n(data.current_salary) || getAnnualPay(budget),
        annual_raise_percent: n(data.annual_raise_percent),
        accounts: accountsFromDb,
        annual_return_percent: n(data.annual_return_percent),
        withdrawal_rate_percent: n(data.withdrawal_rate_percent),
        social_security_monthly_estimate: n(data.social_security_monthly_estimate),
        inflation_percent: n(data.inflation_percent),
      };
      const projection = runProjection(profile);
      setEstimatedRetirement(projection?.total_portfolio ?? null);
    }
    loadRetirementEstimate();
  }, [budget]);

  const nextPayday = getNextPayday(budget);
  const paydayForBills = nextPayday ?? budget?.next_payday ?? null;

  const upcomingBills = useMemo(() => {
    if (!budget) return [];
    return getDashboardBillsBeforePayday(
      recurringBills,
      bills,
      paydayForBills,
      new Date()
    );
  }, [budget, recurringBills, bills, paydayForBills]);

  const billsTotal = upcomingBills.reduce(
    (sum, bill) => sum + Number(bill.amount),
    0
  );

  const expensesTotal = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const currentBalance = budget
    ? Number(budget.balance) - expensesTotal
    : 0;

  const expectedPaycheck = getExpectedPaycheck(budget);
  const monthlyPay = getMonthlyPay(budget);

  const goalsData = useMemo(
    () => (userId ? loadUserGoals(userId) : null),
    [userId]
  );

  const savePct = goalsData?.save_percent ?? 0;
  const investPct = goalsData?.invest_percent ?? 0;

  const monthlySavings = monthlyPay > 0 ? monthlyPay * (savePct / 100) : 0;
  const monthlyInvesting = monthlyPay > 0 ? monthlyPay * (investPct / 100) : 0;

  const goalsToSubtract = useMemo(() => {
    if (!budget || monthlyPay <= 0) return 0;
    return monthlySavings + monthlyInvesting;
  }, [budget, monthlyPay, monthlySavings, monthlyInvesting]);

  const savingsTimelines = useMemo(() => {
    if (!userId || !budget) return [];
    return getSavingsGoalTimelines(budget, goalsData ?? null, monthlySavings);
  }, [userId, budget, goalsData, monthlySavings]);

  const safeToSpend = Math.max(
    0,
    currentBalance - billsTotal - goalsToSubtract
  );

  const daysUntilPayday = nextPayday ? getDaysUntil(nextPayday) : 0;

  const dailySpendingLimit =
    daysUntilPayday > 0 ? safeToSpend / daysUntilPayday : safeToSpend;

  const safeToSpendStatus = getSafeToSpendStatus(
    safeToSpend,
    dailySpendingLimit,
    daysUntilPayday
  );

  const currentMonthCategoryTotals = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    return expenses
      .filter((e) => {
        const d = new Date(e.created_at);
        return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
      })
      .reduce((acc, expense) => {
        const category = expense.category || "Other";
        acc[category] = (acc[category] || 0) + Number(expense.amount);
        return acc;
      }, {} as Record<string, number>);
  }, [expenses]);

  useEffect(() => {
    async function fetchGuidance() {
      if (!budget) return;

      const goalsData = userId ? loadUserGoals(userId) : null;
      const investPercent = goalsData?.invest_percent ?? 0;
      const monthlyRetirement =
        monthlyPay > 0 && investPercent > 0
          ? Math.round((monthlyPay * investPercent) / 100)
          : 0;

      try {
        const response = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            balance: currentBalance,
            safeToSpend,
            billsTotal,
            expensesTotal,
            dailySpendingLimit,
            nextPayday: nextPayday ?? budget?.next_payday ?? "",
            daysUntilPayday,
            expectedPaycheck,
            upcomingBills: upcomingBills.map((b) => ({
              name: b.name,
              amount: Number(b.amount),
              due_date: b.due_date,
            })),
            investPercent: goalsData?.invest_percent,
            savePercent: goalsData?.save_percent,
            monthlyRetirementContribution: monthlyRetirement,
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
      }
    }

    fetchGuidance();
  }, [
    userId,
    budget,
    currentBalance,
    nextPayday,
    safeToSpend,
    billsTotal,
    expensesTotal,
    dailySpendingLimit,
    daysUntilPayday,
    expectedPaycheck,
    monthlyPay,
    upcomingBills,
  ]);

  const recentCategories = Object.entries(currentMonthCategoryTotals)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 3);

  const insightAccent = getInsightAccent(safeToSpendStatus.status);

  if (loading) {
    return (
      <DashboardShell title="Overview" subtitle="Loading your dashboard...">
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-8 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.8)] backdrop-blur-xl dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-emerald-500/20" />
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-700/80" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-700/50" />
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const moreBillsCount = Math.max(0, upcomingBills.length - 3);
  const topSpendSummary =
    recentCategories.length === 0
      ? null
      : `${recentCategories
          .slice(0, 2)
          .map(([c, t]) => `${c} ${formatMoney(Number(t))}`)
          .join(" · ")}${recentCategories.length > 2 ? ` · +${recentCategories.length - 2}` : ""}`;

  return (
    <DashboardShell
      title="Overview"
      subtitle="One calm view of this pay period."
    >
      <motion.div
        variants={staggerContainer(reduce, 0.055, 0.05)}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-8 pb-8"
      >
        <motion.div
          variants={staggerContainer(reduce, 0.06, 0)}
          initial="hidden"
          animate="visible"
          className="grid gap-6 lg:grid-cols-12 lg:items-stretch"
        >
          <motion.div variants={fadeUpItem(reduce)} className="lg:col-span-7">
            <OverviewSafeToSpendHero
              amountValue={safeToSpend}
              untilLabel={nextPayday ? formatDate(nextPayday) : "payday"}
              status={safeToSpendStatus.status}
              badgeLabel={safeToSpendStatus.label}
            />
          </motion.div>
          <motion.div variants={fadeUpItem(reduce)} className="lg:col-span-5">
            <OverviewRetirementHero
              formattedAmount={
                estimatedRetirement != null && estimatedRetirement > 0
                  ? formatMoney(estimatedRetirement)
                  : "—"
              }
              hasEstimate={estimatedRetirement != null && estimatedRetirement > 0}
              caption={
                estimatedRetirement != null && estimatedRetirement > 0
                  ? "Projected total at retirement."
                  : "Add your profile to see a projection."
              }
            />
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer(reduce, 0.05, 0)}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-3 sm:gap-6"
        >
          <OverviewGlassStat
            label="Current balance"
            value={formatMoney(currentBalance)}
            subtext="After expenses you’ve logged."
          />
          <OverviewGlassStat
            label="Next payday"
            value={nextPayday ? formatDate(nextPayday) : "—"}
            subtext={
              <>
                {daysUntilPayday} day{daysUntilPayday === 1 ? "" : "s"} out
                {expectedPaycheck > 0 && <> · {formatMoney(expectedPaycheck)} expected</>}
              </>
            }
          />
          <OverviewGlassStat
            label="Daily limit"
            value={formatMoney(dailySpendingLimit)}
            subtext="A steady pace until payday."
          />
        </motion.div>

        <motion.div variants={fadeUpItem(reduce)}>
          <OverviewWhatToDoNext
            guidance={guidance}
            financialStatus={safeToSpendStatus.status}
            accent={insightAccent}
          >
            <MotionLink
              href="/insights"
              whileHover={
                reduce
                  ? undefined
                  : { scale: 1.02, transition: { duration: 0.15, ease: EASE_OUT } }
              }
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-emerald-500 motion-reduce:transition-none"
            >
              Insights
            </MotionLink>
            <MotionLink
              href="/projection"
              whileHover={
                reduce
                  ? undefined
                  : { scale: 1.02, transition: { duration: 0.15, ease: EASE_OUT } }
              }
              whileTap={reduce ? undefined : { scale: 0.98 }}
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors duration-150 ease-out hover:border-white/20 hover:bg-white/[0.04] motion-reduce:transition-none"
            >
              Projection
            </MotionLink>
          </OverviewWhatToDoNext>
        </motion.div>

        <motion.div
          variants={staggerContainer(reduce, 0.07, 0)}
          initial="hidden"
          animate="visible"
          className="grid gap-6 xl:grid-cols-2"
        >
          <motion.div
            variants={fadeUpItem(reduce)}
            whileHover={
              reduce
                ? undefined
                : {
                    y: -3,
                    boxShadow: "0 14px 40px -16px rgba(0,0,0,0.65)",
                    borderColor: "rgba(255,255,255,0.12)",
                    transition: { duration: 0.18, ease: EASE_OUT },
                  }
            }
            whileTap={reduce ? undefined : { scale: 0.997 }}
            className={panelClassName}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-100">
                Before payday
              </h2>
              <MotionLink
                href="/bills"
                whileHover={
                  reduce
                    ? undefined
                    : { scale: 1.03, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-emerald-400/90 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                Bills
              </MotionLink>
            </div>
            <motion.div
              variants={staggerContainer(reduce, 0.04, 0)}
              initial="hidden"
              animate="visible"
              className="mt-5 max-h-[14rem] space-y-2.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
            >
              {upcomingBills.slice(0, 3).map((bill) => (
                <motion.div
                  key={bill.id}
                  variants={fadeUpItem(reduce)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-900/30 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{bill.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(bill.due_date)}</p>
                  </div>
                  <p className="shrink-0 tabular-nums text-sm font-semibold text-emerald-200/90">
                    {formatMoney(Number(bill.amount))}
                  </p>
                </motion.div>
              ))}

              {moreBillsCount > 0 ? (
                <Link
                  href="/bills"
                  className="block py-2 text-center text-xs font-medium text-slate-500 hover:text-emerald-400/90"
                >
                  +{moreBillsCount} more
                </Link>
              ) : null}

              {upcomingBills.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
                  <p className="text-sm text-slate-300">No bills due in this window.</p>
                  <Link href="/bills" className="mt-2 inline-block text-sm font-medium text-emerald-400">
                    Add bills
                  </Link>
                </div>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeUpItem(reduce)}
            whileHover={
              reduce
                ? undefined
                : {
                    y: -3,
                    boxShadow: "0 14px 40px -16px rgba(0,0,0,0.65)",
                    borderColor: "rgba(255,255,255,0.12)",
                    transition: { duration: 0.18, ease: EASE_OUT },
                  }
            }
            whileTap={reduce ? undefined : { scale: 0.997 }}
            className={panelClassName}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-100">This cycle</h2>
              <MotionLink
                href="/expenses"
                whileHover={
                  reduce
                    ? undefined
                    : { scale: 1.03, transition: { duration: 0.15, ease: EASE_OUT } }
                }
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-sky-400/90 hover:bg-sky-500/10 hover:text-sky-300"
              >
                Expenses
              </MotionLink>
            </div>

            <motion.div
              variants={staggerContainer(reduce, 0.06, 0.02)}
              initial="hidden"
              animate="visible"
              className="mt-6 flex flex-col gap-6 border-b border-white/[0.06] pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-10"
            >
              <motion.div variants={fadeUpItem(reduce)}>
                <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Bills committed
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-50 sm:text-xl">
                  {formatMoney(billsTotal)}
                </p>
              </motion.div>
              <motion.div variants={fadeUpItem(reduce)}>
                <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                  Logged expenses
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-50 sm:text-xl">
                  {formatMoney(expensesTotal)}
                </p>
              </motion.div>
            </motion.div>

            {savingsTimelines.length > 0 ? (
              <Link href="/goals" className="mt-4 block text-sm text-slate-400 transition hover:text-emerald-400/90">
                <span className="text-slate-500">Goals · </span>
                {savingsTimelines.length > 1
                  ? `Next (${savingsTimelines.length} total): `
                  : ""}
                {savingsTimelines[0].name} — ~{formatDateMonthYear(savingsTimelines[0].targetDate)}
              </Link>
            ) : (
              <Link href="/goals" className="mt-4 inline-block text-sm text-slate-500 hover:text-emerald-400/90">
                Set a savings goal
              </Link>
            )}

            <div className="mt-4">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
                Top of month
              </p>
              {topSpendSummary ? (
                <p className="mt-2 text-sm leading-snug text-slate-400">{topSpendSummary}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No category data yet.</p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.06] pt-6 text-sm text-slate-500">
              <MotionLink
                href="/goals"
                whileHover={reduce ? undefined : { color: "rgb(203 213 225)" }}
                className="hover:text-slate-300"
              >
                Goals
              </MotionLink>
              <span className="text-slate-700" aria-hidden>
                ·
              </span>
              <MotionLink
                href="/retirement"
                whileHover={reduce ? undefined : { color: "rgb(203 213 225)" }}
                className="hover:text-slate-300"
              >
                Retirement
              </MotionLink>
              <span className="text-slate-700" aria-hidden>
                ·
              </span>
              <MotionLink
                href="/projection"
                whileHover={reduce ? undefined : { color: "rgb(203 213 225)" }}
                className="hover:text-slate-300"
              >
                Cash projection
              </MotionLink>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell
          title="Overview"
          subtitle="Loading..."
          backHref="/dashboard"
          backLabel="Overview"
          compact
        >
          <div className="balnced-panel rounded-3xl p-6 sm:p-7">
            <p className="text-slate-400">Loading...</p>
          </div>
        </DashboardShell>
      }
    >
      <DashboardOverviewContent />
    </Suspense>
  );
}