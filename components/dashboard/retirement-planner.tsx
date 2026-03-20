"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  runProjection,
  getRetirementStatus,
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const [budget, setBudget] = useState<Budget | null>(null);
  const [goals, setGoals] = useState<UserGoals | null>(null);
  const [monthlyBills, setMonthlyBills] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);

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

  const projection = useMemo(() => {
    if (!profile) return null;
    return runProjection(profile);
  }, [profile]);

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
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400";

  const hasAnyAccount = Boolean(profile.accounts && Object.keys(profile.accounts).length > 0);
  const enabledAccountTypes = Object.keys(profile.accounts ?? {}) as RetirementAccountType[];
  const hasTaxDeferredBucket = enabledAccountTypes.some(
    (t) => getAccountBucket(t) === "tax_deferred"
  );
  const hasRothBucket = enabledAccountTypes.some((t) => getAccountBucket(t) === "roth");
  const hasTaxableBucket = enabledAccountTypes.some((t) => getAccountBucket(t) === "taxable");

  return (
    <div className="balnced-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Retirement planner
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Project balance & income. Suggested monthly amounts on the right; optional Invest % is
            below.
          </p>
        </div>
        {saving && (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-300">
            Saving…
          </span>
        )}
      </div>

      {saveError && (
        <div className="mt-4 rounded-xl bg-rose-50 p-3 dark:bg-rose-900/20">
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">Couldn’t save</p>
          <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{saveError}</p>
        </div>
      )}

      {!hasAnyAccount && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/50 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Get started</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            Enable at least one retirement account below to see projections and investing guidance.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5 sm:gap-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start xl:grid-cols-[minmax(0,340px)_1fr]">
          {/* Inputs */}
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

          <div className="border-t border-slate-200 pt-4 dark:border-slate-600">
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

        {/* Results + Chart + suggested monthly (cashflow) */}
        <div className="min-h-0 space-y-6 lg:min-w-0">
          {projection && statusResult ? (
            <>
              {/* Status badge */}
              <div
                className={`rounded-3xl p-5 sm:p-6 ${
                  STATUS_STYLES[statusResult.status].bg
                } ${STATUS_STYLES[statusResult.status].text}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Retirement health
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="balnced-row rounded-2xl p-5 sm:col-span-2 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total portfolio at retirement
                  </p>
                  <p className="mt-1.5 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-2xl">
                    {formatMoney(projection.total_portfolio)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Tax-deferred bucket
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                    {formatMoney(projection.final_tax_deferred_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Roth bucket
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                    {formatMoney(projection.final_roth_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Taxable bucket
                  </p>
                  <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-100 sm:text-xl">
                    {formatMoney(projection.final_taxable_balance)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Projected final salary
                  </p>
                  <p className="mt-1.5 text-base font-bold tabular-nums text-slate-100 sm:text-lg">
                    {formatMoney(projection.projected_final_salary)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Annual retirement income (total)
                  </p>
                  <p className="mt-1.5 text-base font-bold tabular-nums text-slate-100 sm:text-lg">
                    {formatMoney(projection.annual_total_retirement_income)}
                  </p>
                </div>
                <div className="balnced-row rounded-2xl p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Monthly retirement income (total)
                  </p>
                  <p className="mt-1.5 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-lg">
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

        <p className="text-xs text-slate-400 dark:text-slate-500">
          This is an estimate for illustration only and is not financial advice. Actual returns and outcomes will vary.
        </p>
      </div>
    </div>
  );
}

function n(v: unknown): number {
  if (v == null || v === "") return 0;
  return Number(v);
}
