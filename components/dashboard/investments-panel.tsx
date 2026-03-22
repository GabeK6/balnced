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
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";
import { useUserPlan } from "@/hooks/use-user-plan";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";
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
  const { hasProAccess, loading: planLoading } = useUserPlan();
  const proReady = !planLoading;
  const isPro = proReady && hasProAccess;

  /** Loads profile + dashboard numbers; Pro gating uses `useUserPlan()` above. */
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

  const recommendationPlan: RecommendationPlan | null = useMemo(() => {
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
    if (!budget || !recommendationPlan) return;
    if (!isPro) {
      setRecommendation(null);
      return;
    }
    setRecommendationLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setRecommendation(null);
        setRecommendationLoading(false);
        return;
      }

      const localProjection = profile ? runProjection(profile) : null;
      const localRetirementStatus =
        localProjection && profile
          ? getRetirementStatus(localProjection, profile).status
          : null;
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          monthlyPay: recommendationPlan.monthlyIncome,
          monthlyIncome: recommendationPlan.monthlyIncome,
          paycheckIncome: recommendationPlan.paycheckIncome,
          monthlyBills: recommendationPlan.monthlyBills,
          monthlyExpenses: recommendationPlan.monthlyExpenses,
          suggestedSaveMonthly: recommendationPlan.suggestedSaveMonthly,
          suggestedInvestMonthly: recommendationPlan.suggestedInvestMonthly,
          discretionaryMonthly: recommendationPlan.discretionaryMonthly,
          savePercent: recommendationPlan.savePercent,
          investPercent:
            recommendationPlan.monthlyIncome > 0 && recommendationPlan.suggestedInvestMonthly > 0
              ? Math.min(100, (recommendationPlan.suggestedInvestMonthly / recommendationPlan.monthlyIncome) * 100)
              : recommendationPlan.investPercent,
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
      const data = (await res.json()) as { recommendation?: string; error?: string };
      if (res.status === 403 || data.error === "PRO_REQUIRED") {
        setRecommendation(null);
      } else {
        setRecommendation(data.recommendation || null);
      }
    } catch {
      setRecommendation("Could not load recommendations.");
    }
    setRecommendationLoading(false);
  }, [budget, profile, goals, recommendationPlan, isPro]);

  useEffect(() => {
    if (!loading && userId && budget && recommendationPlan && isPro) fetchRecommendations();
  }, [loading, userId, budget, recommendationPlan, isPro, fetchRecommendations]);

  if (loading) {
    return (
      <div className="balnced-panel rounded-3xl p-5 sm:p-6">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const mainGridClass = showSuggestedMonthly
    ? "grid items-start gap-6 sm:grid-cols-1 lg:grid-cols-2"
    : "grid items-start gap-6 sm:grid-cols-1";

  return (
    <div className="space-y-6" id="retirement-contributions">
      <div className={mainGridClass}>
        {proReady ? (
          isPro ? (
            <div className="flex min-h-0 flex-col gap-3 overflow-auto rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white shadow-[0_12px_40px_-20px_rgba(16,185,129,0.45)] sm:p-7">
              <h3 className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-100/90">
                AI recommendation
              </h3>
              <p className="text-sm font-semibold leading-snug text-white">Personalized insight</p>
              <p className="text-xs leading-relaxed text-emerald-100/90">
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
                className="mt-2 min-h-[2.75rem] rounded-xl border border-white/20 bg-white/15 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors duration-150 hover:bg-white/25 disabled:opacity-50 motion-reduce:transition-none"
              >
                Refresh recommendation
              </button>
            </div>
          ) : (
            <ProFeatureTeaser title="AI allocation insight" surface="investments" />
          )
        ) : (
          <div className={PRO_GATING_PLACEHOLDER_CLASS} aria-hidden />
        )}

        {showSuggestedMonthly && (
          <SuggestedMonthlyAmountsCard plan={recommendationPlan} variant="investments" />
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        {TRUST_DISCLAIMER} Actual outcomes will vary.
      </p>
    </div>
  );
}
