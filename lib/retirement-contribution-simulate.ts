/**
 * Build temporary retirement profile for "what-if" contribution slider.
 * Scales **employee** deferrals to match `monthlyEmployeeContribution`; employer match unchanged.
 */

import type { RetirementProfile } from "./retirement-projection";
import {
  getAccountBucket,
  type InvestedAccountConfig,
  type RetirementAccountType,
  type RetirementAccounts,
} from "./retirement-accounts";

const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

export function buildProfileWithSimulatedEmployeeMonthly(
  profile: RetirementProfile,
  monthlyEmployeeContribution: number
): RetirementProfile {
  const cloned = structuredClone(profile) as RetirementProfile;
  const salary = Math.max(0, n(cloned.current_salary));
  const accounts = cloned.accounts ?? {};
  const investedTypes = (Object.keys(accounts) as RetirementAccountType[]).filter(
    (t) => getAccountBucket(t) !== null
  );

  const targetAnnual = Math.max(0, monthlyEmployeeContribution) * 12;

  if (investedTypes.length === 0) {
    return cloned;
  }

  const baselineAnnualByType: Partial<Record<RetirementAccountType, number>> = {};
  let totalBaseline = 0;

  for (const type of investedTypes) {
    const cfg = accounts[type] as InvestedAccountConfig;
    const pct = Math.max(0, Math.min(100, n(cfg.contribution_percent_of_salary))) / 100;
    const annualPart = Math.max(0, n(cfg.annual_contribution));
    const emp = salary * pct + annualPart;
    baselineAnnualByType[type] = emp;
    totalBaseline += emp;
  }

  const nextAccounts = { ...accounts } as RetirementAccounts;

  if (totalBaseline <= 0) {
    for (const type of investedTypes) {
      const orig = accounts[type] as InvestedAccountConfig;
      nextAccounts[type] = {
        ...orig,
        contribution_percent_of_salary: 0,
        annual_contribution: 0,
      };
    }
    const first = investedTypes[0];
    const orig = accounts[first] as InvestedAccountConfig;
    nextAccounts[first] = {
      ...orig,
      contribution_percent_of_salary: 0,
      annual_contribution: targetAnnual,
      contribution_grows_with_salary: true,
    };
    cloned.accounts = nextAccounts;
    return cloned;
  }

  const scale = targetAnnual / totalBaseline;

  for (const type of investedTypes) {
    const orig = accounts[type] as InvestedAccountConfig;
    const base = baselineAnnualByType[type] ?? 0;
    const scaled = base * scale;
    const hadPct = n(orig.contribution_percent_of_salary) > 0;
    nextAccounts[type] = {
      ...orig,
      contribution_percent_of_salary: 0,
      annual_contribution: scaled,
      contribution_grows_with_salary: hadPct || Boolean(orig.contribution_grows_with_salary),
    };
  }

  cloned.accounts = nextAccounts;
  return cloned;
}
