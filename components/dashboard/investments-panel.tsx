"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  runProjection,
  getRetirementStatus,
  type RetirementProfile,
} from "@/lib/retirement-projection";
import { legacyToAccounts, plannedRetirementContributionsMonthly } from "@/lib/retirement-accounts";
import {
  loadDashboardData,
  loadUserGoals,
  type UserGoals,
  type Budget,
  type RecurringBill,
} from "@/lib/dashboard-data";
import {
  computeRecommendationPlan,
  type RecommendationPlan,
} from "@/lib/recommendation";
import { SuggestedMonthlyAmountsCard } from "@/components/dashboard/suggested-monthly-amounts-card";

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  return Number(v);
}

export default function InvestmentsPanel({
  showSuggestedMonthly = true,
}: {
  showSuggestedMonthly?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [profile, setProfile] = useState<RetirementProfile | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [monthlyBills, setMonthlyBills] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      setLoading(false);
      return;
    }

    const { data: row, error } = await supabase
      .from("retirement_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Retirement profile fetch error:", error);
    }

    let profileToSet: RetirementProfile | null = null;
    if (row) {
      const accountsFromDb =
        row.retirement_accounts && typeof row.retirement_accounts === "object"
          ? row.retirement_accounts
          : legacyToAccounts(row);
      profileToSet = {
        current_age: n(row.current_age),
        retirement_age: n(row.retirement_age),
        current_salary: n(row.current_salary),
        annual_raise_percent: n(row.annual_raise_percent),
        accounts: accountsFromDb,
        annual_return_percent: n(row.annual_return_percent),
        withdrawal_rate_percent: n(row.withdrawal_rate_percent),
        social_security_monthly_estimate: n(row.social_security_monthly_estimate),
        inflation_percent: n(row.inflation_percent),
      };
    }

    const dashboard = await loadDashboardData();
    if (dashboard.user) {
      setUserId(dashboard.user.id);
      setBudget(dashboard.budget);
      const monthlyFromRecurring = (dashboard.recurringBills as RecurringBill[]).reduce(
        (sum, rb) => {
          const amt = Number(rb.amount);
          if (rb.frequency === "monthly") return sum + amt;
          if (rb.frequency === "weekly") return sum + amt * 4.33;
          if (rb.frequency === "biweekly") return sum + amt * 2.17;
          return sum + amt;
        },
        0
      );
      const oneTimeBills = dashboard.bills.filter(
        (b) => !b.recurring_bill_id && !b.is_paid && !b.archived
      );
      const oneTimeTotal = oneTimeBills.reduce((s, b) => s + Number(b.amount), 0);
      const monthlyBillsEstimate = monthlyFromRecurring + oneTimeTotal / 2;
      const expensesTotalValue = dashboard.expenses.reduce(
        (s, e) => s + Number(e.amount),
        0
      );
      setMonthlyBills(monthlyBillsEstimate);
      setExpensesTotal(expensesTotalValue);
      const saved = loadUserGoals(dashboard.user.id);
      setGoals(saved ?? null);
      setProfile(profileToSet);
    } else {
      setProfile(profileToSet);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plan: RecommendationPlan | null = useMemo(() => {
    if (!budget) return null;
    const fromPlanner =
      profile != null
        ? plannedRetirementContributionsMonthly({
            accounts: profile.accounts,
            annualSalary: profile.current_salary ?? 0,
          })
        : 0;
    return computeRecommendationPlan({
      budget,
      goals: goals ?? null,
      monthlyBills,
      expensesTotal,
      plannedRetirementContributionsMonthly: fromPlanner,
    });
  }, [budget, goals, monthlyBills, expensesTotal, profile]);

  const fetchRecommendations = useCallback(async () => {
    if (!budget || !plan) return;
    setRecommendationLoading(true);
    try {
      const localProjection = profile ? runProjection(profile) : null;
      const localRetirementStatus =
        localProjection && profile
          ? getRetirementStatus(localProjection, profile).status
          : null;
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyPay: plan.monthlyIncome,
          monthlyIncome: plan.monthlyIncome,
          paycheckIncome: plan.paycheckIncome,
          monthlyBills: plan.monthlyBills,
          monthlyExpenses: plan.monthlyExpenses,
          suggestedSaveMonthly: plan.suggestedSaveMonthly,
          suggestedInvestMonthly: plan.suggestedInvestMonthly,
          discretionaryMonthly: plan.discretionaryMonthly,
          savePercent: plan.savePercent,
          investPercent:
            plan.monthlyIncome > 0 && plan.suggestedInvestMonthly > 0
              ? Math.min(100, (plan.suggestedInvestMonthly / plan.monthlyIncome) * 100)
              : plan.investPercent,
          retirementAge: profile?.retirement_age ?? 65,
          currentAge: profile?.current_age ?? 35,
          bigPurchaseName: goals?.big_purchase_name?.trim() || null,
          bigPurchaseAmount: goals?.big_purchase_amount ?? null,
          retirement: {
            enabledAccounts: profile?.accounts ? Object.keys(profile.accounts) : [],
            retirementStatus: localRetirementStatus,
          },
        }),
      });
      const data = await res.json();
      setRecommendation(data.recommendation || null);
    } catch {
      setRecommendation("Could not load recommendations.");
    }
    setRecommendationLoading(false);
  }, [budget, profile, goals, plan]);

  useEffect(() => {
    if (!loading && userId && budget && plan) fetchRecommendations();
  }, [loading, userId, budget, plan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="balnced-panel rounded-3xl p-5 sm:p-6">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const mainGridClass = showSuggestedMonthly
    ? "grid gap-4 sm:gap-5 items-start sm:grid-cols-1 lg:grid-cols-2"
    : "grid gap-4 sm:gap-5 items-start sm:grid-cols-1";

  return (
    <div className="space-y-4" id="retirement-contributions">
      <div className={mainGridClass}>
        <div className="flex min-h-0 flex-col gap-2 overflow-auto rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 sm:p-6 text-white shadow-sm">
          <h2 className="shrink-0 text-base font-semibold">AI recommendation</h2>
          <p className="text-xs leading-relaxed text-emerald-100/95">
            Based on your pay, retirement accounts, and goals.
          </p>
          {recommendationLoading ? (
            <p className="mt-4 text-emerald-100">Loading...</p>
          ) : recommendation ? (
            <p className="mt-2 min-h-0 flex-1 overflow-auto text-sm leading-relaxed">
              {recommendation}
            </p>
          ) : (
            <p className="mt-4 text-emerald-100">Add income to see advice.</p>
          )}
          <button
            type="button"
            onClick={fetchRecommendations}
            disabled={recommendationLoading || !budget}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/30 disabled:opacity-50"
          >
            Refresh recommendation
          </button>
        </div>

        {showSuggestedMonthly && (
          <SuggestedMonthlyAmountsCard plan={plan} variant="investments" />
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        This is an estimate for illustration only and is not financial advice. Actual outcomes will
        vary.
      </p>
    </div>
  );
}
