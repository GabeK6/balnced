import type { Debt } from "@/lib/debt-types";
import { orderDebtsForPayoffStrategy } from "@/lib/debt/strategies";

export type DebtSnapshot = {
  totalDebt: number;
  weightedAverageApr: number;
  totalMinimumPayments: number;
  estimatedMonthlyInterest: number;
  highestAprDebtName: string | null;
  highestApr: number | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * - totalDebt = sum(balance)
 * - weightedAverageApr = totalDebt > 0 ? sum(balance * apr) / totalDebt : 0
 * - estimatedMonthlyInterest = sum(balance * (apr / 100) / 12)
 */
export function computeDebtSnapshot(debts: Debt[]): DebtSnapshot {
  let totalDebt = 0;
  let weightedAprSum = 0;
  let totalMinimumPayments = 0;
  let estimatedMonthlyInterest = 0;
  let highestApr: number | null = null;
  let highestAprDebtName: string | null = null;

  for (const d of debts) {
    const balance = Math.max(0, num(d.balance));
    const apr = Math.max(0, num(d.apr));
    const minPay = Math.max(0, num(d.minimum_payment));

    totalDebt += balance;
    weightedAprSum += balance * apr;
    totalMinimumPayments += minPay;
    estimatedMonthlyInterest += balance * (apr / 100) / 12;

    if (highestApr === null || apr > highestApr) {
      highestApr = apr;
      highestAprDebtName = (d.name ?? "").trim() || "Debt";
    }
  }

  const weightedAverageApr =
    totalDebt > 0 ? weightedAprSum / totalDebt : 0;

  if (debts.length === 0) {
    return {
      totalDebt: 0,
      weightedAverageApr: 0,
      totalMinimumPayments: 0,
      estimatedMonthlyInterest: 0,
      highestAprDebtName: null,
      highestApr: null,
    };
  }

  return {
    totalDebt,
    weightedAverageApr,
    totalMinimumPayments,
    estimatedMonthlyInterest,
    highestAprDebtName,
    highestApr,
  };
}

export function formatAprPercent(value: number, decimals: 1 | 2 = 2): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toFixed(decimals)}%`;
}

export type DebtSortKey =
  | "balance_desc"
  | "balance_asc"
  | "apr_desc"
  | "apr_asc"
  /** Payoff planning: smallest balance first (snowball). */
  | "payoff_snowball"
  /** Payoff planning: highest APR first (avalanche). */
  | "payoff_avalanche";

export function sortDebts(debts: Debt[], sort: DebtSortKey): Debt[] {
  if (sort === "payoff_snowball") {
    return orderDebtsForPayoffStrategy(debts, "snowball");
  }
  if (sort === "payoff_avalanche") {
    return orderDebtsForPayoffStrategy(debts, "avalanche");
  }

  const copy = [...debts];
  copy.sort((a, b) => {
    const ba = num(a.balance);
    const bb = num(b.balance);
    const aa = num(a.apr);
    const ab = num(b.apr);
    switch (sort) {
      case "balance_desc":
        return bb - ba || aa - ab;
      case "balance_asc":
        return ba - bb || ab - aa;
      case "apr_desc":
        return ab - aa || bb - ba;
      case "apr_asc":
        return aa - ab || ba - bb;
      default:
        return 0;
    }
  });
  return copy;
}

export const HIGH_INTEREST_APR_THRESHOLD = 20;

export function isHighInterestApr(apr: number): boolean {
  return num(apr) >= HIGH_INTEREST_APR_THRESHOLD;
}
