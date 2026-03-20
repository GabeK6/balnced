/**
 * Retirement projection and status logic.
 * All values come from user input or defaults — no hardcoded financial data.
 */

import {
  getAccountBucket,
  type InvestedAccountConfig,
  type PensionAccountConfig,
  type RetirementAccountType,
  type RetirementAccounts,
} from "./retirement-accounts";

export type RetirementProfile = {
  id?: string;
  user_id?: string;
  current_age: number;
  retirement_age: number;
  current_salary: number;
  annual_raise_percent: number;

  /** Shared return assumption used for projecting invested accounts. */
  annual_return_percent: number;
  /** Portfolio withdrawal rate used to estimate annual retirement withdrawals. */
  withdrawal_rate_percent: number;

  social_security_monthly_estimate: number;
  inflation_percent: number;

  /** Enabled retirement accounts (invested accounts + pension income). */
  accounts: RetirementAccounts;

  created_at?: string;
  updated_at?: string;
};

export type YearlyProjectionRow = {
  year: number;
  age: number;
  salary: number;
  /** Bucket totals at end of the year. */
  tax_deferred_balance: number;
  roth_balance: number;
  taxable_balance: number;
  total_portfolio: number;
};

export type ProjectionResult = {
  yearly: YearlyProjectionRow[];

  /** Sum of invested accounts at retirement. */
  total_portfolio: number;
  final_tax_deferred_balance: number;
  final_roth_balance: number;
  final_taxable_balance: number;

  /** Ending balances for each enabled invested account (pension excluded). */
  final_balances_by_account: Partial<Record<RetirementAccountType, number>>;

  /** Annual withdrawals estimated from invested portfolio. */
  annual_retirement_income: number;
  monthly_retirement_income: number;
  /** Includes portfolio withdrawals + Social Security + pension income. */
  monthly_with_social_security: number;
  annual_total_retirement_income: number;
  monthly_total_retirement_income: number;

  projected_final_salary: number;
};

export type RetirementStatus =
  | "Behind"
  | "On Track"
  | "Strong"
  | "Very Strong";

export type RetirementStatusResult = {
  status: RetirementStatus;
  replacement_ratio: number;
  projected_final_salary: number;
  summary: string;
};

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

function getInvestedContributionForYear(args: {
  account: InvestedAccountConfig;
  salary: number;
  annualContributionSoFar: number;
}) {
  const salary = Math.max(0, args.salary);
  const pct =
    Math.max(0, Math.min(100, n(args.account.contribution_percent_of_salary))) / 100;
  const employerMatchPct =
    Math.max(0, Math.min(100, n(args.account.employer_match_percent))) / 100;

  const salaryBased = salary * pct;
  const employerMatch = salary * employerMatchPct;
  const annualBased = Math.max(0, n(args.annualContributionSoFar));

  return {
    annualContribution: salaryBased + annualBased,
    annualEmployerMatch: employerMatch,
  };
}

/**
 * Run year-by-year projection from current_age to retirement_age.
 * Treats each enabled account independently, then aggregates into bucket totals.
 */
export function runProjection(
  profile: RetirementProfile
): ProjectionResult | null {
  const currentAge = Math.max(
    0,
    Math.min(120, Math.floor(n(profile.current_age)))
  );
  const retirementAge = Math.max(
    currentAge,
    Math.min(120, Math.floor(n(profile.retirement_age)))
  );
  const yearsToRetirement = retirementAge - currentAge;
  if (yearsToRetirement <= 0) return null;

  const salary = Math.max(0, n(profile.current_salary));
  const raisePct = n(profile.annual_raise_percent) / 100;
  const returnPct = n(profile.annual_return_percent) / 100;
  const withdrawalPct = n(profile.withdrawal_rate_percent) / 100;
  const ssMonthly = Math.max(0, n(profile.social_security_monthly_estimate));

  const accounts = profile.accounts ?? {};
  const enabledAccountTypes = Object.keys(accounts) as RetirementAccountType[];

  // Current state of each enabled invested account.
  const investedTypes = enabledAccountTypes.filter((t) => getAccountBucket(t) !== null);
  const curBalanceByAccount: Partial<Record<RetirementAccountType, number>> = {};
  const curAnnualContributionByAccount: Partial<Record<RetirementAccountType, number>> = {};
  const annualContributionGrowsByAccount: Partial<Record<RetirementAccountType, boolean>> = {};

  for (const type of investedTypes) {
    const cfg = accounts[type] as InvestedAccountConfig | undefined;
    if (!cfg) continue;
    curBalanceByAccount[type] = Math.max(0, n(cfg.balance));

    const annualContribution =
      cfg.annual_contribution != null
        ? Math.max(0, n(cfg.annual_contribution))
        : 0;
    curAnnualContributionByAccount[type] = annualContribution;
    annualContributionGrowsByAccount[type] = Boolean(cfg.contribution_grows_with_salary);
  }

  const yearly: YearlyProjectionRow[] = [];
  let curSalary = salary;
  let curYear = currentAge;

  const computeBucketTotals = () => {
    let taxDeferred = 0;
    let roth = 0;
    let taxable = 0;

    for (const type of investedTypes) {
      const bucket = getAccountBucket(type);
      const balance = curBalanceByAccount[type] ?? 0;
      if (bucket === "tax_deferred") taxDeferred += balance;
      else if (bucket === "roth") roth += balance;
      else if (bucket === "taxable") taxable += balance;
    }

    const total = taxDeferred + roth + taxable;
    return { taxDeferred, roth, taxable, total };
  };

  const initial = computeBucketTotals();
  yearly.push({
    year: curYear,
    age: curYear,
    salary,
    tax_deferred_balance: initial.taxDeferred,
    roth_balance: initial.roth,
    taxable_balance: initial.taxable,
    total_portfolio: initial.total,
  });

  for (let y = 0; y < yearsToRetirement; y++) {
    const age = currentAge + y;

    for (const type of investedTypes) {
      const cfg = accounts[type] as InvestedAccountConfig | undefined;
      if (!cfg) continue;

      const curBalance = curBalanceByAccount[type] ?? 0;
      const annualContributionSoFar = curAnnualContributionByAccount[type] ?? 0;

      const { annualContribution, annualEmployerMatch } = getInvestedContributionForYear({
        account: cfg,
        salary: curSalary,
        annualContributionSoFar,
      });

      let nextBalance = curBalance + annualContribution + annualEmployerMatch;
      nextBalance *= 1 + returnPct;
      curBalanceByAccount[type] = nextBalance;

      if (annualContributionGrowsByAccount[type]) {
        curAnnualContributionByAccount[type] = annualContributionSoFar * (1 + raisePct);
      }
    }

    // End-of-year snapshot.
    curYear = age + 1;
    const totals = computeBucketTotals();
    yearly.push({
      year: curYear,
      age: curYear,
      salary: curSalary,
      tax_deferred_balance: totals.taxDeferred,
      roth_balance: totals.roth,
      taxable_balance: totals.taxable,
      total_portfolio: totals.total,
    });

    curSalary *= 1 + raisePct;
  }

  const last = yearly[yearly.length - 1];
  if (!last) return null;

  const pensionCfg = accounts.pension as PensionAccountConfig | undefined;
  const pensionMonthly = pensionCfg ? Math.max(0, n(pensionCfg.monthly_income)) : 0;

  const annualPortfolioWithdrawal = last.total_portfolio * Math.max(0, withdrawalPct);
  const monthlyPortfolioWithdrawal = annualPortfolioWithdrawal / 12;

  const annualSS = ssMonthly * 12;
  const annualPension = pensionMonthly * 12;

  const annualTotal = annualPortfolioWithdrawal + annualSS + annualPension;
  const monthlyTotal = annualTotal / 12;

  const finalBalancesByAccount: Partial<Record<RetirementAccountType, number>> = {};
  for (const type of investedTypes) {
    finalBalancesByAccount[type] = curBalanceByAccount[type] ?? 0;
  }

  return {
    yearly,
    total_portfolio: last.total_portfolio,
    final_tax_deferred_balance: last.tax_deferred_balance,
    final_roth_balance: last.roth_balance,
    final_taxable_balance: last.taxable_balance,
    final_balances_by_account: finalBalancesByAccount,
    annual_retirement_income: annualPortfolioWithdrawal,
    monthly_retirement_income: monthlyPortfolioWithdrawal,
    monthly_with_social_security: monthlyTotal,
    annual_total_retirement_income: annualTotal,
    monthly_total_retirement_income: monthlyTotal,
    projected_final_salary: last.salary,
  };
}

/**
 * Classify retirement status and compute replacement ratio.
 * Uses portfolio withdrawals + Social Security + pension vs projected final salary.
 */
export function getRetirementStatus(
  projection: ProjectionResult,
  profile: RetirementProfile
): RetirementStatusResult {
  const ssMonthly = Math.max(0, n(profile.social_security_monthly_estimate));
  const annualSS = ssMonthly * 12;

  const pensionCfg = profile.accounts.pension as PensionAccountConfig | undefined;
  const annualPension = pensionCfg
    ? Math.max(0, n(pensionCfg.monthly_income)) * 12
    : 0;

  const totalRetirementIncome =
    projection.annual_retirement_income + annualSS + annualPension;

  const finalSalary = projection.projected_final_salary;
  const replacement_ratio =
    finalSalary > 0 ? totalRetirementIncome / finalSalary : 0;

  let status: RetirementStatus;
  let summary: string;

  if (replacement_ratio < 0.5) {
    status = "Behind";
    summary = "You may need to increase contributions to stay on track.";
  } else if (replacement_ratio < 0.7) {
    status = "On Track";
    summary = "You are building a solid retirement path.";
  } else if (replacement_ratio < 0.9) {
    status = "Strong";
    summary = "You are on pace for a strong retirement income.";
  } else {
    status = "Very Strong";
    summary = "You are on pace for a very strong retirement income.";
  }

  return {
    status,
    replacement_ratio,
    projected_final_salary: finalSalary,
    summary,
  };
}
