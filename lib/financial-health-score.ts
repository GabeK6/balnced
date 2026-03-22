import type { FinancialStatus } from "@/lib/financial-status";

export type FinancialHealthBand = "poor" | "stable" | "strong";

export type FinancialHealthResult = {
  /** 0–100 */
  score: number;
  band: FinancialHealthBand;
  /** Display label for the band */
  statusLabel: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Simple composite: liquidity, bills pressure, savings rate, retirement/invest rate.
 * Weights sum to 100; small adjustments for tight/overspending status.
 */
export function computeFinancialHealthScore(params: {
  safeToSpend: number;
  monthlyPay: number;
  billsCommitted: number;
  savePercent: number;
  investPercent: number;
  /** Projected portfolio; used as a small “on track” bonus when present. */
  estimatedRetirement: number | null;
  financialStatus: FinancialStatus;
}): FinancialHealthResult {
  const {
    safeToSpend,
    monthlyPay,
    billsCommitted,
    savePercent,
    investPercent,
    estimatedRetirement,
    financialStatus,
  } = params;

  const mp = Math.max(0, monthlyPay);

  // 0–25: cushion vs monthly income (15%+ of monthly as safe-to-spend ≈ full)
  const safeRatio = mp > 0 ? safeToSpend / mp : 0;
  let liquidity = clamp(safeRatio * (100 / 0.15) * 0.25, 0, 25);

  // 0–25: lower bills share of monthly income = better
  const billsRatio = mp > 0 ? billsCommitted / mp : 0;
  const billsScore = 25 * (1 - clamp(billsRatio / 0.55, 0, 1));

  // 0–25: savings goals (save %) — 20% of income ≈ full
  const savingsScore = clamp((savePercent / 20) * 25, 0, 25);

  // 0–25: retirement / invest rate + small bonus when projection exists
  let retirementScore = clamp(investPercent * 1.25, 0, 20);
  if (estimatedRetirement != null && estimatedRetirement > 0) {
    retirementScore = clamp(retirementScore + 5, 0, 25);
  }

  let total = liquidity + billsScore + savingsScore + retirementScore;

  if (financialStatus === "overspending") {
    total = Math.max(0, total - 18);
  } else if (financialStatus === "tight") {
    total = Math.max(0, total - 8);
  } else if (financialStatus === "improving") {
    total = Math.max(0, total - 4);
  }

  const score = Math.round(clamp(total, 0, 100));

  let band: FinancialHealthBand;
  let statusLabel: string;
  if (score < 45) {
    band = "poor";
    statusLabel = "Poor";
  } else if (score < 75) {
    band = "stable";
    statusLabel = "Stable";
  } else {
    band = "strong";
    statusLabel = "Strong";
  }

  return { score, band, statusLabel };
}
