"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  runProjection,
  getRetirementStatus,
  type ProjectionResult,
  type RetirementProfile,
  type RetirementStatus,
} from "@/lib/retirement-projection";
import {
  formatAccountLabel,
  getAccountBucket,
  getAccountDefaults,
  accountsToLegacyColumns,
  legacyToAccounts,
  plannedRetirementContributionsMonthly,
  employeeRetirementContributionsMonthly,
  type InvestedAccountConfig,
  type PensionAccountConfig,
  type RetirementAccountType,
  type RetirementAccounts,
} from "@/lib/retirement-accounts";
import {
  loadDashboardData,
  loadUserGoals,
  getAnnualPay,
  type Budget,
  type UserGoals,
  type RecurringBill,
} from "@/lib/dashboard-data";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";
import { useUserPlan } from "@/hooks/use-user-plan";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";

/** PostgREST when `retirement_accounts` JSONB column was never migrated on the project DB. */
function isMissingRetirementAccountsColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("retirement_accounts") && m.includes("schema");
}
import {
  computeRecommendationPlan,
  type RecommendationPlan,
} from "@/lib/recommendation";
import { SuggestedMonthlyAmountsCard } from "@/components/dashboard/suggested-monthly-amounts-card";
import RetirementAiAdvice from "@/components/dashboard/retirement-ai-advice";
import RetirementNextStepCard from "@/components/dashboard/retirement-next-step-card";
import { getRetirementNextStep } from "@/lib/retirement-next-step";
import { buildProfileWithSimulatedEmployeeMonthly } from "@/lib/retirement-contribution-simulate";
import ContributionSimulatorCard from "@/components/dashboard/contribution-simulator-card";
import {
  getRetirementBenchmarkHeadline,
  getRetirementBenchmarkInsightLines,
} from "@/lib/retirement-benchmark-insights";
import RetirementBenchmarkInsightsCard from "@/components/dashboard/retirement-benchmark-insights-card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const DEFAULT_PROFILE: Omit<RetirementProfile, "id" | "user_id" | "created_at" | "updated_at"> = {
  current_age: 0,
  retirement_age: 65,
  current_salary: 0,
  annual_raise_percent: 3,
  annual_return_percent: 7,
  withdrawal_rate_percent: 4,
  social_security_monthly_estimate: 0,
  inflation_percent: 2.5,
  accounts: {},
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`;
}

type OutcomeDeltas = {
  portfolio: number;
  income: number;
  health: number;
};

function outcomeDeltaToneClass(delta: number): string {
  if (delta === 0) return "text-slate-400";
  return delta > 0 ? "text-emerald-300/95" : "text-rose-300/95";
}

/** Income replacement target and safe withdrawal assumption for “required portfolio” math (annual $). */
const HEALTH_DEFAULT_REPLACEMENT_RATIO = 0.7;
const HEALTH_WITHDRAWAL_RATE = 0.04;

/** Header “Retirement Health” visuals by score band (not income-replacement status). */
const HEALTH_SCORE_UI = {
  needsAttention: {
    headline: "Needs Attention" as const,
    dotClass: "bg-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
  },
  onTrack: {
    headline: "On Track" as const,
    dotClass: "bg-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
  },
  strongProgress: {
    headline: "Strong Progress" as const,
    dotClass: "bg-emerald-300",
    badgeClass: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/35",
  },
} as const;

type RetirementHealthUi = {
  headline: string;
  pct: number;
  barWidthPct: number;
  display: (typeof HEALTH_SCORE_UI)[keyof typeof HEALTH_SCORE_UI];
  hint: string;
  /** Total invested portfolio at retirement from projections. */
  projectedPortfolio: number | null;
  /** Goal nest egg from (finalSalary × replacement ratio) ÷ withdrawal rate. */
  requiredPortfolio: number | null;
  /** Salary in the final projected year (annual). */
  projectedFinalSalary: number | null;
  replacementRatioPercent: number;
  withdrawalRatePercent: number;
};

const RETIREMENT_HEALTH_INCOMPLETE: RetirementHealthUi = {
  headline: "Needs Attention",
  pct: 0,
  barWidthPct: 0,
  display: HEALTH_SCORE_UI.needsAttention,
  hint: "Set a retirement age after your current age to see readiness.",
  projectedPortfolio: null,
  requiredPortfolio: null,
  projectedFinalSalary: null,
  replacementRatioPercent: HEALTH_DEFAULT_REPLACEMENT_RATIO * 100,
  withdrawalRatePercent: HEALTH_WITHDRAWAL_RATE * 100,
};

/** Stable string of all fields that affect `runProjection` — keeps derived UI in sync with nested account edits. */
function profileToProjectionFingerprint(profile: RetirementProfile | null): string {
  if (!profile) return "";
  try {
    return JSON.stringify({
      current_age: profile.current_age,
      retirement_age: profile.retirement_age,
      current_salary: profile.current_salary,
      annual_raise_percent: profile.annual_raise_percent,
      annual_return_percent: profile.annual_return_percent,
      withdrawal_rate_percent: profile.withdrawal_rate_percent,
      social_security_monthly_estimate: profile.social_security_monthly_estimate,
      inflation_percent: profile.inflation_percent,
      accounts: profile.accounts ?? {},
    });
  } catch {
    return `${profile.current_age}|${profile.retirement_age}|${profile.current_salary}`;
  }
}

function computeRetirementHealthUi(projection: ProjectionResult | null): RetirementHealthUi {
  if (!projection) {
    return RETIREMENT_HEALTH_INCOMPLETE;
  }

  const finalSalary = Math.max(0, projection.projected_final_salary);
  const projectedPortfolio = Math.max(0, projection.total_portfolio);
  const annualNeed = finalSalary * HEALTH_DEFAULT_REPLACEMENT_RATIO;
  const requiredPortfolio =
    annualNeed > 0 ? annualNeed / HEALTH_WITHDRAWAL_RATE : 0;

  let pct = 0;
  if (requiredPortfolio > 0) {
    pct = Math.round(
      Math.min(100, Math.max(0, (projectedPortfolio / requiredPortfolio) * 100))
    );
  }

  const barWidthPct = pct <= 0 ? 0 : Math.min(100, Math.max(3, pct));

  const tier =
    pct < 50
      ? HEALTH_SCORE_UI.needsAttention
      : pct <= 80
        ? HEALTH_SCORE_UI.onTrack
        : HEALTH_SCORE_UI.strongProgress;

  const hint =
    requiredPortfolio <= 0
      ? "Add your current salary so we can estimate your retirement portfolio target."
      : `Bar tracks progress toward your target: ${formatMoney(projectedPortfolio)} of ${formatMoney(requiredPortfolio)} (${pct}%).`;

  return {
    headline: tier.headline,
    pct,
    barWidthPct,
    display: tier,
    hint,
    projectedPortfolio,
    requiredPortfolio: requiredPortfolio > 0 ? requiredPortfolio : null,
    projectedFinalSalary: finalSalary > 0 ? finalSalary : null,
    replacementRatioPercent: HEALTH_DEFAULT_REPLACEMENT_RATIO * 100,
    withdrawalRatePercent: HEALTH_WITHDRAWAL_RATE * 100,
  };
}

/** Progress fill + glow from score bands: red (<50), amber/yellow (50–80), green (>80). */
function healthProgressBarClasses(pct: number): { fill: string; glow: string } {
  let fill: string;
  if (pct < 50) {
    fill =
      "bg-gradient-to-r from-rose-600 via-rose-500 to-red-500";
  } else if (pct <= 80) {
    fill =
      "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-400";
  } else {
    fill =
      "bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400";
  }

  let glow = "";
  if (pct > 80) {
    glow =
      "shadow-[0_0_16px_-2px_rgba(52,211,153,0.55),0_0_32px_-8px_rgba(16,185,129,0.38)]";
  } else if (pct >= 50) {
    glow = "shadow-[0_0_12px_-2px_rgba(250,204,21,0.4)]";
  } else if (pct > 0) {
    glow = "shadow-[0_0_10px_-2px_rgba(244,63,94,0.28)]";
  }

  return { fill, glow };
}

const STATUS_STYLES: Record<
  RetirementStatus,
  { bg: string; text: string; label: string }
> = {
  Behind: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    label: "Behind",
  },
  "On Track": {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    label: "On Track",
  },
  Strong: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-200",
    label: "Strong",
  },
  "Very Strong": {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-800 dark:text-violet-200",
    label: "Very Strong",
  },
};

const DEBOUNCE_MS = 800;

export default function RetirementPlanner() {
  const [profile, setProfile] = useState<RetirementProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const profileIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planInputsRef = useRef<HTMLDivElement | null>(null);
  const accountsSectionRef = useRef<HTMLDivElement | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [budget, setBudget] = useState<Budget | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [monthlyBills, setMonthlyBills] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const { hasProAccess, loading: userPlanLoading } = useUserPlan();
  const proReady = !userPlanLoading;
  const isPro = proReady && hasProAccess;

  /** Loads profile + dashboard-derived numbers; Pro gating uses `useUserPlan()` above. */
  const loadProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("retirement_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Retirement profile fetch error:", error);
      setLoading(false);
      return;
    }

    let profileToSet: RetirementProfile;
    if (data) {
      const id = data.id;
      if (id) {
        setProfileId(id);
        profileIdRef.current = id;
      }

      const accountsFromDb =
        data.retirement_accounts && typeof data.retirement_accounts === "object"
          ? data.retirement_accounts
          : legacyToAccounts(data);

      profileToSet = {
        current_age: n(data.current_age),
        retirement_age: n(data.retirement_age),
        current_salary: n(data.current_salary),
        annual_raise_percent: n(data.annual_raise_percent),
        accounts: accountsFromDb,
        annual_return_percent: n(data.annual_return_percent),
        withdrawal_rate_percent: n(data.withdrawal_rate_percent),
        social_security_monthly_estimate: n(data.social_security_monthly_estimate),
        inflation_percent: n(data.inflation_percent),
      };
    } else {
      setProfileId(null);
      profileIdRef.current = null;
      profileToSet = {
        ...DEFAULT_PROFILE,
        current_age: 30,
        retirement_age: 65,
      };
    }

    const dashboard = await loadDashboardData();
    if (dashboard.user) {
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
      const savedGoals = loadUserGoals(dashboard.user.id);
      setGoals(savedGoals ?? null);

      if (dashboard.budget && profileToSet.current_salary === 0) {
        const annualFromBudget = getAnnualPay(dashboard.budget);
        if (annualFromBudget > 0) {
          profileToSet = { ...profileToSet, current_salary: annualFromBudget };
        }
      }
      setProfile(profileToSet);
    } else {
      setProfile(profileToSet);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = useCallback(
    async (next: RetirementProfile) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSaveError("Not signed in");
        return;
      }

      setSaveError(null);
      setSaving(true);
      const buildRow = (includeRetirementAccountsJson: boolean) => {
        const base = {
          user_id: user.id,
          current_age: next.current_age,
          retirement_age: next.retirement_age,
          current_salary: next.current_salary,
          annual_raise_percent: next.annual_raise_percent,
          ...accountsToLegacyColumns(next.accounts),
          annual_return_percent: next.annual_return_percent,
          withdrawal_rate_percent: next.withdrawal_rate_percent,
          social_security_monthly_estimate: next.social_security_monthly_estimate,
          inflation_percent: next.inflation_percent,
          updated_at: new Date().toISOString(),
        };
        return includeRetirementAccountsJson
          ? { ...base, retirement_accounts: next.accounts }
          : base;
      };

      const idToUse = profileId ?? profileIdRef.current;

      const persist = async (row: ReturnType<typeof buildRow>) => {
        if (idToUse) {
          return supabase
            .from("retirement_profiles")
            .update(row)
            .eq("id", idToUse)
            .eq("user_id", user.id)
            .select("id")
            .single();
        }
        return supabase
          .from("retirement_profiles")
          .insert({ ...row, created_at: new Date().toISOString() })
          .select("id")
          .single();
      };

      let { data, error } = await persist(buildRow(true));
      if (error && isMissingRetirementAccountsColumnError(error.message)) {
        ({ data, error } = await persist(buildRow(false)));
      }
      if (error) {
        setSaveError(error.message || "Failed to save");
        setSaving(false);
        return;
      }
      if (data?.id) {
        profileIdRef.current = data.id;
        setProfileId(data.id);
      }
      setSaving(false);
    },
    [profileId]
  );

  const commitProfile = useCallback(
    (next: RetirementProfile) => {
      setProfile(next);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        saveProfile(next);
      }, DEBOUNCE_MS);
    },
    [saveProfile]
  );

  const updateField = useCallback(
    <K extends keyof RetirementProfile>(key: K, value: RetirementProfile[K]) => {
      if (!profile) return;
      commitProfile({ ...profile, [key]: value });
    },
    [profile, commitProfile]
  );

  const toggleAccount = useCallback(
    (type: RetirementAccountType) => {
      if (!profile) return;
      const cur = (profile.accounts ?? {}) as RetirementAccounts;
      const enabled = Boolean(cur[type]);
      const nextAccounts: RetirementAccounts = { ...cur };
      if (enabled) {
        delete nextAccounts[type];
      } else {
        nextAccounts[type] = getAccountDefaults(type);
      }
      commitProfile({ ...profile, accounts: nextAccounts });
    },
    [profile, commitProfile]
  );

  const updateAccountField = useCallback(
    (type: RetirementAccountType, patch: Record<string, unknown>) => {
      if (!profile) return;
      const cur = (profile.accounts ?? {}) as RetirementAccounts;
      const base =
        (cur[type] ?? getAccountDefaults(type)) as InvestedAccountConfig | PensionAccountConfig;
      const merged = {
        ...(base as Record<string, unknown>),
        ...patch,
      } as InvestedAccountConfig | PensionAccountConfig;
      const nextAccounts: RetirementAccounts = { ...cur, [type]: merged };
      commitProfile({ ...profile, accounts: nextAccounts });
    },
    [profile, commitProfile]
  );

  const profileFingerprint = useMemo(
    () => profileToProjectionFingerprint(profile),
    [profile]
  );

  const { projection, retirementHealthUi } = useMemo(() => {
    if (!profile) {
      return {
        projection: null as ProjectionResult | null,
        retirementHealthUi: RETIREMENT_HEALTH_INCOMPLETE,
      };
    }
    const projection = runProjection(profile);
    return {
      projection,
      retirementHealthUi: computeRetirementHealthUi(projection),
    };
  }, [profile, profileFingerprint]);

  const statusResult = useMemo(() => {
    if (!projection || !profile) return null;
    return getRetirementStatus(projection, profile);
  }, [projection, profile]);

  const cashflowPlan: RecommendationPlan | null = useMemo(() => {
    if (!budget) return null;
    const fromPlanner = plannedRetirementContributionsMonthly({
      accounts: profile?.accounts,
      annualSalary: profile?.current_salary ?? 0,
    });
    return computeRecommendationPlan({
      budget,
      goals,
      monthlyBills,
      expensesTotal,
      plannedRetirementContributionsMonthly: fromPlanner,
    });
  }, [budget, goals, monthlyBills, expensesTotal, profile?.accounts, profile?.current_salary]);

  /** Monthly retirement $ encoded in planner accounts (for next-step rules). */
  const plannedMonthlyFromAccounts = useMemo(() => {
    if (!profile) return 0;
    return plannedRetirementContributionsMonthly({
      accounts: profile.accounts,
      annualSalary: profile.current_salary ?? 0,
    });
  }, [profile]);

  /** Employee-only monthly deferrals (simulator baseline; employer match excluded). */
  const baselineEmployeeMonthly = useMemo(
    () =>
      profile
        ? employeeRetirementContributionsMonthly({
            accounts: profile.accounts,
            annualSalary: profile.current_salary,
          })
        : 0,
    [profile]
  );

  const contributionSimSliderMax = useMemo(
    () => Math.min(8000, Math.max(2000, Math.ceil((baselineEmployeeMonthly + 150) / 50) * 50)),
    [baselineEmployeeMonthly]
  );

  const [contributionSimOverride, setContributionSimOverride] = useState<number | null>(null);

  useEffect(() => {
    setContributionSimOverride(null);
  }, [profileFingerprint]);

  const effectiveContributionSimMonthly =
    contributionSimOverride !== null ? contributionSimOverride : baselineEmployeeMonthly;

  const contributionSimProfile = useMemo(() => {
    if (!profile) return null;
    const clamped = Math.min(
      contributionSimSliderMax,
      Math.max(0, effectiveContributionSimMonthly)
    );
    return buildProfileWithSimulatedEmployeeMonthly(profile, clamped);
  }, [profile, effectiveContributionSimMonthly, contributionSimSliderMax]);

  const contributionSimProjection = useMemo(
    () => (contributionSimProfile ? runProjection(contributionSimProfile) : null),
    [contributionSimProfile]
  );

  const contributionSimHealthUi = useMemo(
    () => computeRetirementHealthUi(contributionSimProjection),
    [contributionSimProjection]
  );

  const retirementBenchmarkInsightLines = useMemo(() => {
    if (!profile) return [];
    const gross = Math.max(0, profile.current_salary);
    const deferralPct =
      gross > 0
        ? Math.round((baselineEmployeeMonthly * 12 * 100) / gross)
        : null;
    return getRetirementBenchmarkInsightLines({
      currentAge: profile.current_age,
      investPercentGoals: goals?.invest_percent,
      savePercentGoals: goals?.save_percent,
      retirementDeferralPercentOfGross: deferralPct,
    });
  }, [
    profile,
    baselineEmployeeMonthly,
    goals?.invest_percent,
    goals?.save_percent,
  ]);

  const retirementBenchmarkHeadline = useMemo(
    () => getRetirementBenchmarkHeadline(retirementBenchmarkInsightLines),
    [retirementBenchmarkInsightLines]
  );

  const suggestedContributionDisplay = useMemo(() => {
    if (!cashflowPlan) return "—";
    return formatMoney(cashflowPlan.suggestedInvestMonthly);
  }, [cashflowPlan]);

  /** Snapshot for /api/retirement-advice (debounced in child). */
  const retirementAdviceSnapshot = useMemo(() => {
    if (!profile) return null;
    const yearsToRetirement = Math.max(
      0,
      Math.floor(Number(profile.retirement_age) - Number(profile.current_age))
    );
    const goalsForAdvice =
      goals != null
        ? {
            save_percent: goals.save_percent,
            invest_percent: goals.invest_percent,
            big_purchase_name: goals.big_purchase_name ?? null,
            big_purchase_amount: goals.big_purchase_amount ?? null,
            retirement_age: goals.retirement_age,
            savings_goals: goals.savings_goals?.map((g) => ({
              name: g.name,
              target_amount: g.amount,
              priority: g.priority,
            })),
          }
        : null;
    return {
      currentAge: Number(profile.current_age) || 0,
      retirementAge: Number(profile.retirement_age) || 0,
      annualSalary: Number(profile.current_salary) || 0,
      suggestedMonthlyInvest: cashflowPlan?.suggestedInvestMonthly ?? 0,
      projectedPortfolio: projection?.total_portfolio ?? 0,
      targetPortfolio: retirementHealthUi.requiredPortfolio ?? 0,
      healthScorePercent: retirementHealthUi.pct,
      healthBand: retirementHealthUi.headline,
      yearsToRetirement,
      monthlyRetirementIncome: projection?.monthly_total_retirement_income ?? 0,
      goals: goalsForAdvice,
    };
  }, [profile, projection, retirementHealthUi, cashflowPlan, goals]);

  const scrollToAccounts = useCallback(() => {
    accountsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** Rule-based next step (shown when planner content is visible). */
  const retirementNextStep = useMemo(() => {
    if (!profile) {
      return getRetirementNextStep({
        currentAge: 0,
        retirementAge: 0,
        annualSalary: 0,
        healthPct: 0,
        monthlyIncome: 0,
        suggestedInvestMonthly: 0,
        plannedRetirementContributionsMonthly: 0,
        hasAnyAccount: false,
        distinctBucketCount: 0,
        requiredPortfolio: null,
      });
    }
    const enabledTypes = Object.keys(profile.accounts ?? {}) as RetirementAccountType[];
    const bucketCount = new Set(enabledTypes.map((t) => getAccountBucket(t))).size;
    const hasAcc = enabledTypes.length > 0;
    return getRetirementNextStep({
      currentAge: profile.current_age,
      retirementAge: profile.retirement_age,
      annualSalary: profile.current_salary,
      healthPct: retirementHealthUi.pct,
      monthlyIncome: cashflowPlan?.monthlyIncome ?? 0,
      suggestedInvestMonthly: cashflowPlan?.suggestedInvestMonthly ?? 0,
      plannedRetirementContributionsMonthly: plannedMonthlyFromAccounts,
      hasAnyAccount: hasAcc,
      distinctBucketCount: bucketCount,
      requiredPortfolio: retirementHealthUi.requiredPortfolio,
    });
  }, [
    profile,
    retirementHealthUi.pct,
    retirementHealthUi.requiredPortfolio,
    cashflowPlan?.monthlyIncome,
    cashflowPlan?.suggestedInvestMonthly,
    plannedMonthlyFromAccounts,
  ]);

  const chartData = useMemo(() => {
    if (!projection?.yearly?.length || !profile) return [];
    return projection.yearly.map((row) => {
      const point: Record<string, number> = {
        age: row.age,
        Total: Math.round(row.total_portfolio),
        "Tax-deferred": Math.round(row.tax_deferred_balance),
        Roth: Math.round(row.roth_balance),
        Taxable: Math.round(row.taxable_balance),
      };
      return point;
    });
  }, [projection, profile]);

  const prevOutcomeRef = useRef<{
    totalPortfolio: number;
    monthlyTotalIncome: number;
    healthPct: number;
  } | null>(null);
  const [outcomeDeltas, setOutcomeDeltas] = useState<OutcomeDeltas | null>(null);
  const [outcomeFlashKey, setOutcomeFlashKey] = useState(0);

  useEffect(() => {
    if (!projection) {
      prevOutcomeRef.current = null;
      setOutcomeDeltas(null);
      return;
    }

    const current = {
      totalPortfolio: projection.total_portfolio,
      monthlyTotalIncome: projection.monthly_total_retirement_income,
      healthPct: retirementHealthUi.pct,
    };

    const prev = prevOutcomeRef.current;
    prevOutcomeRef.current = current;

    if (prev === null) {
      return;
    }

    const portfolio = current.totalPortfolio - prev.totalPortfolio;
    const income = current.monthlyTotalIncome - prev.monthlyTotalIncome;
    const health = current.healthPct - prev.healthPct;

    const trivial =
      Math.abs(portfolio) < 1 &&
      Math.abs(income) < 0.5 &&
      health === 0;

    if (trivial) {
      return;
    }

    setOutcomeFlashKey((k) => k + 1);
    setOutcomeDeltas({ portfolio, income, health });

    const id = window.setTimeout(() => setOutcomeDeltas(null), 2400);
    return () => window.clearTimeout(id);
  }, [projection, retirementHealthUi.pct]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="balnced-panel rounded-3xl p-5 sm:p-6">
        <p className="text-slate-500 dark:text-slate-400">Loading retirement planner...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="balnced-panel rounded-3xl p-5 sm:p-6">
        <p className="text-slate-500 dark:text-slate-400">Unable to load retirement profile.</p>
      </div>
    );
  }

  const inputClass =
    "balnced-input";
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-500";
  const kickerClass =
    "text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500";
  const heroMetricCardClass =
    "flex min-h-[8rem] flex-col rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:min-h-[8.25rem] sm:p-5";
  const heroMetricValueClass =
    "mt-3 text-3xl font-semibold tracking-tight text-slate-50 tabular-nums sm:text-[2rem] lg:text-[2.125rem]";
  const btnHeroSecondaryClass =
    "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm backdrop-blur-md transition-colors duration-150 hover:border-emerald-400/25 hover:bg-white/[0.14] motion-reduce:transition-none";

  const hasAnyAccount = Boolean(profile.accounts && Object.keys(profile.accounts).length > 0);
  const enabledAccountTypes = Object.keys(profile.accounts ?? {}) as RetirementAccountType[];
  const hasTaxDeferredBucket = enabledAccountTypes.some(
    (t) => getAccountBucket(t) === "tax_deferred"
  );
  const hasRothBucket = enabledAccountTypes.some((t) => getAccountBucket(t) === "roth");
  const hasTaxableBucket = enabledAccountTypes.some((t) => getAccountBucket(t) === "taxable");

  const healthBarVisual = healthProgressBarClasses(retirementHealthUi.pct);

  function scrollToPlanInputs() {
    planInputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="balnced-panel rounded-3xl p-6 sm:p-8">
      <div className="space-y-6">
        <RetirementNextStepCard
          step={retirementNextStep}
          onUpdatePlan={scrollToPlanInputs}
          onAddAccounts={scrollToAccounts}
        />

        {!proReady ? (
          <div className={PRO_GATING_PLACEHOLDER_CLASS} aria-hidden />
        ) : !isPro ? (
          <ProFeatureTeaser title="Retirement Pro" surface="retirement" />
        ) : null}

        {isPro && retirementBenchmarkInsightLines.length > 0 ? (
          <RetirementBenchmarkInsightsCard
            lines={retirementBenchmarkInsightLines}
            headline={retirementBenchmarkHeadline}
            currentAge={profile.current_age}
          />
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/20 via-slate-900/50 to-slate-950/60 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-shadow duration-300 sm:p-7 hover:shadow-[0_20px_50px_-24px_rgba(16,185,129,0.12)] motion-reduce:transition-none">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-emerald-300 backdrop-blur-sm"
                  aria-hidden
                >
                  <TrendingUp className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-[1.875rem]">
                    Retirement Planner
                  </h2>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
                    Live projections from your plan, income, and goals—updated as you edit.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {saving ? (
                  <span className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm">
                    Saving…
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={scrollToPlanInputs}
                  className={btnHeroSecondaryClass}
                >
                  Edit Plan
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
              <div className={heroMetricCardClass}>
                <p className={kickerClass}>Current salary</p>
                <p className={heroMetricValueClass}>{formatMoney(profile.current_salary)}</p>
              </div>
              <div className={heroMetricCardClass}>
                <p className={kickerClass}>Retirement age</p>
                <p className={heroMetricValueClass}>{profile.retirement_age}</p>
              </div>
              <div className={`${heroMetricCardClass} justify-between`}>
                <p className={kickerClass}>Suggested monthly contribution</p>
                <p className={`${heroMetricValueClass} text-emerald-300`}>{suggestedContributionDisplay}</p>
                <p className="mt-auto pt-2 text-xs leading-relaxed text-slate-500">
                  Based on your income and goals.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6">
              <p className={kickerClass}>Retirement goal</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Target nest egg uses your{" "}
                <span className="text-slate-400">projected final salary</span>,{" "}
                <span className="tabular-nums text-slate-400">
                  {Math.round(retirementHealthUi.replacementRatioPercent)}% income replacement
                </span>
                , and a{" "}
                <span className="tabular-nums text-slate-400">
                  {retirementHealthUi.withdrawalRatePercent}% withdrawal
                </span>{" "}
                rule — same basis as Retirement Health.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <div className="flex min-h-[9rem] flex-col rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <p className={kickerClass}>Projected at retirement</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 tabular-nums sm:text-[2rem]">
                    {retirementHealthUi.projectedPortfolio != null
                      ? formatMoney(Math.round(retirementHealthUi.projectedPortfolio))
                      : "—"}
                  </p>
                  <p className="mt-2 text-xs leading-snug text-slate-500">
                    Total portfolio in your plan
                  </p>
                  {retirementHealthUi.requiredPortfolio != null &&
                  retirementHealthUi.requiredPortfolio > 0 ? (
                    <p className="mt-auto pt-3 text-xs font-medium tabular-nums text-slate-400">
                      {retirementHealthUi.pct}% of your goal
                    </p>
                  ) : null}
                </div>
                <div className="flex min-h-[9rem] flex-col rounded-xl border border-emerald-500/25 bg-emerald-950/25 p-4 sm:p-5">
                  <p className={`${kickerClass} text-emerald-200/90`}>Your target</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-200 tabular-nums sm:text-[2rem]">
                    {retirementHealthUi.requiredPortfolio != null
                      ? formatMoney(Math.round(retirementHealthUi.requiredPortfolio))
                      : "—"}
                  </p>
                  <p className="mt-2 text-xs leading-snug text-slate-500">
                    {retirementHealthUi.projectedFinalSalary != null &&
                    retirementHealthUi.requiredPortfolio != null ? (
                      <>
                        Goal = (
                        {formatMoney(Math.round(retirementHealthUi.projectedFinalSalary))} ×{" "}
                        {Math.round(retirementHealthUi.replacementRatioPercent)}%) ÷{" "}
                        {retirementHealthUi.withdrawalRatePercent}%
                      </>
                    ) : (
                      "Add salary and valid ages to see your target."
                    )}
                  </p>
                </div>
              </div>
              {retirementHealthUi.requiredPortfolio != null &&
              retirementHealthUi.requiredPortfolio > 0 ? (
                <p className="mt-4 text-sm font-medium leading-snug text-slate-300">
                  You are projected to reach{" "}
                  <span className="tabular-nums text-emerald-300">{retirementHealthUi.pct}%</span>{" "}
                  of your goal.
                </p>
              ) : null}
            </div>
          </div>

          <div className="w-full shrink-0 rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6 lg:mt-0 lg:w-[min(100%,300px)] lg:self-stretch">
            <p className={kickerClass}>Retirement Health</p>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${retirementHealthUi.display.badgeClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${retirementHealthUi.display.dotClass}`}
                  aria-hidden
                />
                {retirementHealthUi.headline}
              </span>
              <span
                className="ml-auto text-2xl font-semibold tabular-nums text-slate-200"
                aria-live="polite"
              >
                {retirementHealthUi.pct}%
              </span>
            </div>
            <div
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/5"
              role="progressbar"
              aria-valuenow={retirementHealthUi.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Retirement readiness"
            >
              <div
                className={`h-full max-w-full rounded-full transition-[width,box-shadow] duration-[600ms] ease-in-out motion-reduce:transition-none motion-reduce:shadow-none ${healthBarVisual.fill} ${healthBarVisual.glow}`}
                style={{ width: `${retirementHealthUi.barWidthPct}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{retirementHealthUi.hint}</p>
          </div>
        </div>

        {outcomeDeltas ? (
          <div
            key={outcomeFlashKey}
            className="balnced-delta-reveal border-t border-white/10 pt-4"
            role="status"
            aria-live="polite"
          >
            <p className={`mb-2 ${kickerClass}`}>Latest change</p>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[0.8125rem] leading-snug">
              {Math.abs(outcomeDeltas.portfolio) >= 1 ? (
                <li
                  className={`flex items-baseline gap-1.5 tabular-nums ${outcomeDeltaToneClass(
                    outcomeDeltas.portfolio
                  )}`}
                >
                  <span className="shrink-0 opacity-90" aria-hidden>
                    {outcomeDeltas.portfolio > 0 ? "↑" : "↓"}
                  </span>
                  <span>
                    {outcomeDeltas.portfolio > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(Math.round(outcomeDeltas.portfolio)))}{" "}
                    <span className="text-slate-500">at retirement</span>
                  </span>
                </li>
              ) : null}
              {Math.abs(outcomeDeltas.income) >= 0.5 ? (
                <li
                  className={`flex items-baseline gap-1.5 tabular-nums ${outcomeDeltaToneClass(
                    outcomeDeltas.income
                  )}`}
                >
                  <span className="shrink-0 opacity-90" aria-hidden>
                    {outcomeDeltas.income > 0 ? "↑" : "↓"}
                  </span>
                  <span>
                    {outcomeDeltas.income > 0 ? "+" : "−"}
                    {formatMoney(Math.abs(Math.round(outcomeDeltas.income)))}
                    <span className="text-slate-500"> /mo retirement income</span>
                  </span>
                </li>
              ) : null}
              {outcomeDeltas.health !== 0 ? (
                <li
                  className={`flex items-baseline gap-1.5 tabular-nums ${outcomeDeltaToneClass(
                    outcomeDeltas.health
                  )}`}
                >
                  <span className="shrink-0 opacity-90" aria-hidden>
                    {outcomeDeltas.health > 0 ? "↑" : "↓"}
                  </span>
                  <span>
                    {outcomeDeltas.health > 0 ? "+" : "−"}
                    {Math.abs(outcomeDeltas.health)}%
                    <span className="text-slate-500"> readiness</span>
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {isPro &&
      projection &&
      enabledAccountTypes.some((t) => getAccountBucket(t) !== null) ? (
        <ContributionSimulatorCard
          monthlyValue={Math.min(
            contributionSimSliderMax,
            Math.max(0, effectiveContributionSimMonthly)
          )}
          onMonthlyChange={(v) => setContributionSimOverride(v)}
          onReset={() => setContributionSimOverride(null)}
          sliderMin={0}
          sliderMax={contributionSimSliderMax}
          baselineMonthly={baselineEmployeeMonthly}
          isDirty={contributionSimOverride !== null}
          metrics={{
            goalPct: contributionSimHealthUi.pct,
            projectedPortfolio: contributionSimHealthUi.projectedPortfolio,
            monthlyRetirementIncome:
              contributionSimProjection?.monthly_total_retirement_income ?? 0,
          }}
          hasGoalTarget={
            contributionSimHealthUi.requiredPortfolio != null &&
            contributionSimHealthUi.requiredPortfolio > 0
          }
          formatMoney={formatMoney}
        />
      ) : null}

      {isPro ? <RetirementAiAdvice snapshot={retirementAdviceSnapshot} /> : null}

      {saveError && (
        <div className="rounded-xl bg-rose-50 p-4 dark:bg-rose-900/20 sm:p-5">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Couldn’t save</p>
          <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{saveError}</p>
        </div>
      )}

      {!hasAnyAccount && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/50 dark:bg-amber-900/20 sm:p-6">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Get started</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Enable at least one retirement account below to see projections and investing guidance.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start xl:grid-cols-[minmax(0,340px)_1fr]">
          {/* Inputs */}
              <div ref={planInputsRef} id="retirement-plan-inputs" className="scroll-mt-24 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-slate-100">Your plan</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Ages, income, accounts, and assumptions — projections update as you type.
                  </p>
                </div>
                <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className={labelClass}>Current age</label>
              <input
                type="number"
                min={18}
                max={100}
                value={profile.current_age || ""}
                onChange={(e) => updateField("current_age", e.target.value === "" ? 0 : Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Retirement age</label>
              <input
                type="number"
                min={50}
                max={100}
                value={profile.retirement_age || ""}
                onChange={(e) => updateField("retirement_age", e.target.value === "" ? 65 : Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Current salary (annual)</label>
            <input
              type="number"
              min={0}
              step={500}
              value={profile.current_salary || ""}
              onChange={(e) => updateField("current_salary", e.target.value === "" ? 0 : Number(e.target.value))}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div>
            <label className={labelClass}>Annual raise %</label>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={profile.annual_raise_percent ?? ""}
              onChange={(e) => updateField("annual_raise_percent", e.target.value === "" ? 3 : Number(e.target.value))}
              className={inputClass}
            />
            <p className="mt-0.5 text-xs text-slate-400">Typical 2–4%</p>
          </div>

          <div
            ref={accountsSectionRef}
            id="retirement-accounts-section"
            className="scroll-mt-24 border-t border-slate-200 pt-4 dark:border-slate-600"
          >
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Retirement accounts you use
            </p>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Enable the accounts that apply to you. Enabled accounts are projected separately and then aggregated into totals.
            </p>

            <div className="space-y-4">
              {(
                [
                  {
                    title: "Employer plans",
                    types: [
                      "trad_401k",
                      "roth_401k",
                      "403b",
                      "457b",
                      "pension",
                    ] as RetirementAccountType[],
                  },
                  {
                    title: "Individual",
                    types: ["trad_ira", "roth_ira"] as RetirementAccountType[],
                  },
                  {
                    title: "Self-employed",
                    types: ["sep_ira", "simple_ira", "solo_401k"] as RetirementAccountType[],
                  },
                  {
                    title: "Optional",
                    types: ["taxable_brokerage"] as RetirementAccountType[],
                  },
                ] as const
              ).map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {group.title}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.types.map((type) => {
                      const enabled = Boolean(profile.accounts?.[type]);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleAccount(type)}
                          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                            enabled
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-600"
                          }`}
                          title={formatAccountLabel(type)}
                        >
                          {formatAccountLabel(type)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {/* Employer plans (invested) */}
              {profile.accounts?.trad_401k && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Traditional 401(k)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.trad_401k as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("trad_401k", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Your contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.trad_401k as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("trad_401k", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Employer match % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.trad_401k as InvestedAccountConfig).employer_match_percent ?? ""}
                        onChange={(e) =>
                          updateAccountField("trad_401k", {
                            employer_match_percent:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                      <p className="mt-0.5 text-xs text-slate-400">
                        Set to 0 if no match.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {profile.accounts?.roth_401k && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Roth 401(k)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.roth_401k as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("roth_401k", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Your contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.roth_401k as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("roth_401k", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Employer match % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.roth_401k as InvestedAccountConfig).employer_match_percent ?? ""}
                        onChange={(e) =>
                          updateAccountField("roth_401k", {
                            employer_match_percent:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                      <p className="mt-0.5 text-xs text-slate-400">
                        Set to 0 if no match.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {profile.accounts?.["403b"] && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    403(b)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts["403b"] as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("403b", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Your contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts["403b"] as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("403b", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {profile.accounts?.["457b"] && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    457(b)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts["457b"] as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("457b", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Your contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts["457b"] as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("457b", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pension */}
              {profile.accounts?.pension && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Pension (retirement income)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Monthly pension income (estimate)</label>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={(profile.accounts.pension as PensionAccountConfig).monthly_income || ""}
                        onChange={(e) =>
                          updateAccountField("pension", {
                            monthly_income: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Pension income is added to retirement income, but not included as an invested balance.
                    </p>
                  </div>
                </div>
              )}

              {/* Individual (IRAs) */}
              {profile.accounts?.trad_ira && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Traditional IRA
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.trad_ira as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("trad_ira", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Annual contribution</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={(profile.accounts.trad_ira as InvestedAccountConfig).annual_contribution || ""}
                        onChange={(e) =>
                          updateAccountField("trad_ira", {
                            annual_contribution: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={(profile.accounts.trad_ira as InvestedAccountConfig).contribution_grows_with_salary ?? false}
                        onChange={(e) =>
                          updateAccountField("trad_ira", {
                            contribution_grows_with_salary: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      Contribution grows with salary
                    </label>
                  </div>
                </div>
              )}

              {profile.accounts?.roth_ira && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Roth IRA
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.roth_ira as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("roth_ira", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Annual contribution</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={(profile.accounts.roth_ira as InvestedAccountConfig).annual_contribution || ""}
                        onChange={(e) =>
                          updateAccountField("roth_ira", {
                            annual_contribution: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={(profile.accounts.roth_ira as InvestedAccountConfig).contribution_grows_with_salary ?? false}
                        onChange={(e) =>
                          updateAccountField("roth_ira", {
                            contribution_grows_with_salary: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      Contribution grows with salary
                    </label>
                  </div>
                </div>
              )}

              {/* Self-employed (SEP/SIMPLE/solo 401k) */}
              {profile.accounts?.sep_ira && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    SEP IRA
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.sep_ira as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("sep_ira", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.sep_ira as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("sep_ira", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {profile.accounts?.simple_ira && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    SIMPLE IRA
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.simple_ira as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("simple_ira", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.simple_ira as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("simple_ira", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              )}

              {profile.accounts?.solo_401k && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Solo 401(k)
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current balance</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.solo_401k as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("solo_401k", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Your contribution % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.solo_401k as InvestedAccountConfig).contribution_percent_of_salary ?? ""}
                        onChange={(e) =>
                          updateAccountField("solo_401k", {
                            contribution_percent_of_salary:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Employer match % of salary</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={(profile.accounts.solo_401k as InvestedAccountConfig).employer_match_percent ?? ""}
                        onChange={(e) =>
                          updateAccountField("solo_401k", {
                            employer_match_percent:
                              e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                      <p className="mt-0.5 text-xs text-slate-400">
                        Set to 0 if you don’t plan employer contributions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Optional */}
              {profile.accounts?.taxable_brokerage && (
                <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
                  <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Taxable brokerage
                  </p>
                  <div className="space-y-2">
                    <div>
                      <label className={labelClass}>Current value</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={(profile.accounts.taxable_brokerage as InvestedAccountConfig).balance || ""}
                        onChange={(e) =>
                          updateAccountField("taxable_brokerage", {
                            balance: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Annual contribution</label>
                      <input
                        type="number"
                        min={0}
                        step={500}
                        value={(profile.accounts.taxable_brokerage as InvestedAccountConfig).annual_contribution || ""}
                        onChange={(e) =>
                          updateAccountField("taxable_brokerage", {
                            annual_contribution: e.target.value === "" ? 0 : Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <input
                        type="checkbox"
                        checked={
                          (profile.accounts.taxable_brokerage as InvestedAccountConfig)
                            .contribution_grows_with_salary ?? false
                        }
                        onChange={(e) =>
                          updateAccountField("taxable_brokerage", {
                            contribution_grows_with_salary: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                      />
                      Contribution grows with salary
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
            <div className="space-y-2">
              <div>
                <label className={labelClass}>Expected annual return %</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={0.5}
                  value={profile.annual_return_percent ?? ""}
                  onChange={(e) =>
                    updateField("annual_return_percent", e.target.value === "" ? 7 : Number(e.target.value))
                  }
                  className={inputClass}
                />
                <p className="mt-0.5 text-xs text-slate-400">Often 5–7% long term</p>
              </div>
              <div>
                <label className={labelClass}>Withdrawal rate %</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.25}
                  value={profile.withdrawal_rate_percent ?? ""}
                  onChange={(e) =>
                    updateField("withdrawal_rate_percent", e.target.value === "" ? 4 : Number(e.target.value))
                  }
                  className={inputClass}
                />
                <p className="mt-0.5 text-xs text-slate-400">4% is a common rule of thumb</p>
              </div>
              <div>
                <label className={labelClass}>Social Security (monthly est.)</label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={profile.social_security_monthly_estimate ?? ""}
                  onChange={(e) =>
                    updateField(
                      "social_security_monthly_estimate",
                      e.target.value === "" ? 0 : Number(e.target.value)
                    )
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </div>
                </div>
        </div>

        {/* Results + Chart + suggested monthly (cashflow) */}
        <div className="min-h-0 space-y-6 lg:min-w-0">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-100">Projection</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Outcomes and trajectory from your current plan.
            </p>
          </div>
          {projection && statusResult ? (
            <>
              {/* Status badge */}
              <div
                className={`rounded-2xl border border-white/10 p-6 sm:p-7 ${
                  STATUS_STYLES[statusResult.status].bg
                } ${STATUS_STYLES[statusResult.status].text}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-current opacity-80">
                    Income replacement view
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                      STATUS_STYLES[statusResult.status].label === "Behind"
                        ? "bg-amber-200 dark:bg-amber-800"
                        : STATUS_STYLES[statusResult.status].label === "On Track"
                          ? "bg-emerald-200 dark:bg-emerald-800"
                          : STATUS_STYLES[statusResult.status].label === "Strong"
                            ? "bg-blue-200 dark:bg-blue-800"
                            : "bg-violet-200 dark:bg-violet-800"
                    } text-slate-100`}
                  >
                    {statusResult.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{statusResult.summary}</p>
                <p className="mt-1 text-xs opacity-90">
                  Replacement ratio: {formatPercent(statusResult.replacement_ratio * 100)} of final salary
                </p>
              </div>

              {/* Outputs */}
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div className="balnced-row rounded-2xl p-5 sm:col-span-2 sm:p-6">
                  <p className={kickerClass}>Total portfolio at retirement</p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-emerald-400 sm:text-[2rem]">
                    {formatMoney(projection.total_portfolio)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Tax-deferred bucket</p>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-slate-100 sm:text-2xl">
                    {formatMoney(projection.final_tax_deferred_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Roth bucket</p>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-slate-100 sm:text-2xl">
                    {formatMoney(projection.final_roth_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Taxable bucket</p>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-slate-100 sm:text-2xl">
                    {formatMoney(projection.final_taxable_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Projected final salary</p>
                  <p className="mt-3 text-lg font-semibold tabular-nums text-slate-100 sm:text-xl">
                    {formatMoney(projection.projected_final_salary)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Annual retirement income (total)</p>
                  <p className="mt-3 text-lg font-semibold tabular-nums text-slate-100 sm:text-xl">
                    {formatMoney(projection.annual_total_retirement_income)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className={kickerClass}>Monthly retirement income (total)</p>
                  <p className="mt-3 text-lg font-semibold tabular-nums text-emerald-400 sm:text-xl">
                    {formatMoney(projection.monthly_total_retirement_income)}
                  </p>
                </div>
              </div>

              {/* Per-account breakdown */}
              {enabledAccountTypes.length > 0 && (
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Per-account breakdown
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {enabledAccountTypes.map((type) => {
                      if (type === "pension") {
                        const pension = profile.accounts.pension as PensionAccountConfig | undefined;
                        const monthly = pension?.monthly_income ?? 0;
                        return (
                          <div
                            key={type}
                            className="balnced-row rounded-xl p-4"
                          >
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatAccountLabel(type)}
                            </p>
                            <p className="mt-1.5 text-base font-bold tabular-nums text-slate-100 sm:text-lg">
                              {formatMoney(monthly)} / mo
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                              Annual: {formatMoney(monthly * 12)}
                            </p>
                          </div>
                        );
                      }

                      const invested = projection.final_balances_by_account[type] ?? 0;
                      return (
                        <div
                          key={type}
                          className="balnced-row rounded-xl p-4"
                        >
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatAccountLabel(type)}
                          </p>
                          <p className="mt-1.5 text-base font-bold tabular-nums text-slate-100 sm:text-lg">
                            {formatMoney(invested)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Portfolio growth over time
                  </p>
                  <div className="h-64 min-h-[240px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid
                          strokeDasharray="0"
                          stroke="#e2e8f0"
                          strokeOpacity={0.6}
                          vertical={false}
                          horizontal={true}
                        />
                        <XAxis
                          dataKey="age"
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis
                          tick={{ fill: "#64748b", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `$${v / 1000}k`}
                          tickCount={5}
                          width={44}
                        />
                        <Tooltip
                          formatter={(value: unknown) => [formatMoney(Number(value ?? 0)), ""]}
                          labelFormatter={(label) => `Age ${label}`}
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            backgroundColor: "#fff",
                          }}
                        />
                        <Legend />
                        {hasTaxDeferredBucket && (
                          <Line
                            type="monotone"
                            dataKey="Tax-deferred"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {hasRothBucket && (
                          <Line
                            type="monotone"
                            dataKey="Roth"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        {hasTaxableBucket && (
                          <Line
                            type="monotone"
                            dataKey="Taxable"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="Total"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="balnced-row rounded-2xl p-6 text-center sm:p-8">
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Enter your age, retirement age, and at least salary or current balances to see projections.
              </p>
            </div>
          )}

          <div className="pt-1">
            <SuggestedMonthlyAmountsCard plan={cashflowPlan} variant="retirement" />
          </div>
        </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          {TRUST_DISCLAIMER} Actual returns and outcomes will vary.
        </p>
      </div>
      </div>
    </div>
  );
}

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  return Number(v);
}
