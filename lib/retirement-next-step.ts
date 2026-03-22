/**
 * Rule-based "next best action" for the Retirement planner (no AI).
 * Earlier rules win — keep conditions explicit and easy to tweak.
 */

export type RetirementNextStepCta =
  | "update_plan"
  | "review_goals"
  | "add_accounts";

export type RetirementNextStep = {
  /** Stable id for analytics / tests */
  id: string;
  title: string;
  explanation: string;
  ctaLabel: string;
  cta: RetirementNextStepCta;
};

export type RetirementNextStepInput = {
  currentAge: number;
  retirementAge: number;
  annualSalary: number;
  /** Retirement health score 0–100 */
  healthPct: number;
  /** Monthly take-home used in cashflow (from budget) */
  monthlyIncome: number;
  /** App-suggested monthly invest/save toward retirement */
  suggestedInvestMonthly: number;
  /** Monthly $ from enabled planner accounts (401k %, IRA, etc.) */
  plannedRetirementContributionsMonthly: number;
  hasAnyAccount: boolean;
  /** Distinct tax buckets among enabled accounts: tax_deferred, roth, taxable */
  distinctBucketCount: number;
  /** Nest-egg target from health UI; null if not computed */
  requiredPortfolio: number | null;
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Returns the highest-priority next step for the current numbers.
 */
export function getRetirementNextStep(input: RetirementNextStepInput): RetirementNextStep {
  const age = Math.max(0, Math.floor(input.currentAge));
  const retAge = Math.max(0, Math.floor(input.retirementAge));
  const salary = Math.max(0, Number(input.annualSalary) || 0);
  const health = clampPct(input.healthPct);
  const monthlyIncome = Math.max(0, Number(input.monthlyIncome) || 0);
  const suggested = Math.max(0, Number(input.suggestedInvestMonthly) || 0);
  const planned = Math.max(0, Number(input.plannedRetirementContributionsMonthly) || 0);
  const target = input.requiredPortfolio != null ? Math.max(0, input.requiredPortfolio) : 0;
  const buckets = Math.max(0, Math.floor(input.distinctBucketCount));

  // 1 — Plan incomplete: can’t reason about readiness
  if (salary <= 0) {
    return {
      id: "add_salary",
      title: "Add your income",
      explanation:
        "Annual salary drives your nest-egg target and how much you can invest each month. Enter your current salary in your plan to unlock clearer next steps.",
      ctaLabel: "Update plan",
      cta: "update_plan",
    };
  }

  if (retAge <= age || retAge < 50) {
    return {
      id: "fix_retirement_age",
      title: "Set a retirement age",
      explanation:
        "Pick a target retirement age after your current age so we can project your portfolio and readiness. Small tweaks here change how much you need to save.",
      ctaLabel: "Update plan",
      cta: "update_plan",
    };
  }

  // 2 — No accounts enabled
  if (!input.hasAnyAccount) {
    return {
      id: "enable_accounts",
      title: "Enable a retirement account",
      explanation:
        "Turn on at least one account you use (401(k), IRA, Roth, etc.) so projections reflect real contributions and employer match.",
      ctaLabel: "Update plan",
      cta: "add_accounts",
    };
  }

  // 3 — Contribution gap vs app suggestion (meaningful only when we have a suggestion)
  const contributionRatio = suggested > 0 ? planned / suggested : 1;
  const lowContribution =
    monthlyIncome > 0 &&
    suggested >= 25 &&
    contributionRatio < 0.8;

  if (lowContribution) {
    return {
      id: "increase_contributions",
      title: "Increase your monthly investment",
      explanation:
        "Your plan suggests setting aside more for retirement than your current account contributions reflect. Raising 401(k)/IRA amounts or your invest % in Goals closes the gap fastest.",
      ctaLabel: "Update plan",
      cta: "update_plan",
    };
  }

  // 4 — Behind goal (readiness)
  if (target > 0 && health < 50) {
    return {
      id: "behind_goal",
      title: "Close the gap to your goal",
      explanation:
        "You’re projected below half of your nest-egg target. Working longer, increasing savings, or trimming near-term spending can improve the picture—pick the lever that fits your life.",
      ctaLabel: "Review goals & plan",
      cta: "review_goals",
    };
  }

  // 5 — Strong progress, shallow diversification
  if (health >= 80 && buckets >= 1 && buckets < 2) {
    return {
      id: "diversify_accounts",
      title: "Consider diversifying accounts",
      explanation:
        "You’re in strong shape on readiness. Adding another account type (for example Roth alongside traditional) can add tax flexibility later—only if it matches your situation.",
      ctaLabel: "Update plan",
      cta: "update_plan",
    };
  }

  // 6 — Strong overall
  if (health >= 80) {
    return {
      id: "strong_progress",
      title: "Keep your momentum",
      explanation:
        "You’re on strong footing versus your target. Revisit assumptions once or twice a year (return rate, salary, retirement age) so the plan stays realistic.",
      ctaLabel: "Update plan",
      cta: "update_plan",
    };
  }

  // 7 — Middle band: nudge without alarm
  if (health >= 50 && health < 80) {
    return {
      id: "build_momentum",
      title: "Build momentum toward your goal",
      explanation:
        "You’re making progress. Even a modest bump to monthly investments or your invest % in Goals can move the readiness bar meaningfully over time.",
      ctaLabel: "Review goals",
      cta: "review_goals",
    };
  }

  // Fallback
  return {
    id: "refine_plan",
    title: "Refine your plan",
    explanation:
      "Update ages, income, and account details so projections and suggestions stay aligned with what you’re actually doing.",
    ctaLabel: "Update plan",
    cta: "update_plan",
  };
}
