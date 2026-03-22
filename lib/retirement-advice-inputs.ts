/** Goal fields that invalidate cached retirement AI when changed. */
export type RetirementAdviceGoalsSnapshot = {
  save_percent?: number;
  invest_percent?: number;
  big_purchase_name?: string | null;
  big_purchase_amount?: number | null;
  retirement_age?: number;
  savings_goals?: { name?: string; target_amount?: number; priority?: number }[];
};

function nz(v: unknown): number {
  if (v == null || v === "") return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Canonical inputs for cache key: salary, contribution, retirement age, goals.
 * Same serialization client + server so fingerprints match without Node crypto on the client.
 */
export function getCanonicalRetirementAdviceInputs(args: {
  annualSalary: number;
  suggestedMonthlyInvest: number;
  retirementAge: number;
  goals: RetirementAdviceGoalsSnapshot | null;
}): Record<string, unknown> {
  const g = args.goals ?? {};
  const savingsGoals = (g.savings_goals ?? [])
    .map((item) => ({
      name: String(item.name ?? "").trim(),
      target_amount: round2(nz(item.target_amount)),
      priority: Math.floor(nz(item.priority)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    annualSalary: round2(nz(args.annualSalary)),
    suggestedMonthlyInvest: round2(nz(args.suggestedMonthlyInvest)),
    retirementAge: Math.max(0, Math.floor(nz(args.retirementAge))),
    save_percent: round2(nz(g.save_percent)),
    invest_percent: round2(nz(g.invest_percent)),
    big_purchase_name: g.big_purchase_name?.trim() || null,
    big_purchase_amount:
      g.big_purchase_amount != null
        ? round2(nz(g.big_purchase_amount))
        : null,
    goals_retirement_age:
      g.retirement_age != null ? Math.max(0, Math.floor(nz(g.retirement_age))) : null,
    savings_goals: savingsGoals,
  };
}

export function retirementAdviceCacheFingerprint(args: {
  annualSalary: number;
  suggestedMonthlyInvest: number;
  retirementAge: number;
  goals: RetirementAdviceGoalsSnapshot | null;
}): string {
  return JSON.stringify(getCanonicalRetirementAdviceInputs(args));
}
