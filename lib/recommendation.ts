import {
  Budget,
  UserGoals,
  getExpectedPaycheck,
  getMonthlyPay,
  getPaychecksPerMonth,
} from "./dashboard-data";

export type RecommendationPlan = {
  monthlyIncome: number;
  paycheckIncome: number;
  paychecksPerMonth: number;
  monthlyBills: number;
  monthlyExpenses: number;
  savePercent: number;
  investPercent: number;
  suggestedSaveMonthly: number;
  suggestedInvestMonthly: number;
  discretionaryMonthly: number;
};

export function computeRecommendationPlan(opts: {
  budget: Budget | null;
  goals: UserGoals | null;
  monthlyBills: number;
  expensesTotal: number;
  /** When set (e.g. live form input), overrides `goals.save_percent` for dollar math */
  savePercentOverride?: number;
  /** When set (e.g. live form input), overrides `goals.invest_percent` for dollar math */
  investPercentOverride?: number;
  /**
   * Monthly $ already encoded in the Retirement planner (401(k) %, IRA annual $, employer match %, etc.).
   * We take the higher of this and income × invest % so Roth/401(k) entries aren’t ignored when Goals % is 0.
   */
  plannedRetirementContributionsMonthly?: number;
}): RecommendationPlan {
  const {
    budget,
    goals,
    monthlyBills,
    expensesTotal,
    savePercentOverride,
    investPercentOverride,
    plannedRetirementContributionsMonthly: plannedFromRetirementPlanner = 0,
  } = opts;

  const monthlyIncome = getMonthlyPay(budget);
  const paycheckIncome = getExpectedPaycheck(budget);
  const paychecksPerMonth = getPaychecksPerMonth(budget);

  const savePercent =
    savePercentOverride != null && Number.isFinite(savePercentOverride)
      ? Math.max(0, savePercentOverride)
      : goals?.save_percent ?? 0;
  const investPercent =
    investPercentOverride != null && Number.isFinite(investPercentOverride)
      ? Math.max(0, investPercentOverride)
      : goals?.invest_percent ?? 0;

  const suggestedSaveMonthly =
    monthlyIncome > 0 ? (monthlyIncome * Math.max(0, savePercent)) / 100 : 0;
  const investFromGoalsPct =
    monthlyIncome > 0 ? (monthlyIncome * Math.max(0, investPercent)) / 100 : 0;
  const investFromPlanner = Math.max(0, Number(plannedFromRetirementPlanner) || 0);
  const suggestedInvestMonthly = Math.max(investFromGoalsPct, investFromPlanner);

  const discretionaryMonthly = Math.max(
    0,
    monthlyIncome - monthlyBills - suggestedSaveMonthly - suggestedInvestMonthly
  );

  return {
    monthlyIncome,
    paycheckIncome,
    paychecksPerMonth,
    monthlyBills,
    monthlyExpenses: expensesTotal,
    savePercent,
    investPercent,
    suggestedSaveMonthly,
    suggestedInvestMonthly,
    discretionaryMonthly,
  };
}

