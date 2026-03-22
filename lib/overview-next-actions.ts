import type { FinancialStatus } from "@/lib/financial-status";

export type OverviewNextAction = {
  id: string;
  title: string;
  detail: string;
  primaryHref: string;
  primaryLabel: string;
};

/**
 * Rule-based “decision engine” for Overview: 1–2 high-impact actions from real numbers only.
 */
export function computeOverviewNextActions(params: {
  safeToSpend: number;
  monthlyPay: number;
  billsCommitted: number;
  /** save % + invest % (0–200). */
  savingsRatePercent: number;
  financialStatus: FinancialStatus;
  daysUntilPayday: number;
}): OverviewNextAction[] {
  const {
    safeToSpend,
    monthlyPay,
    billsCommitted,
    savingsRatePercent,
    financialStatus,
    daysUntilPayday,
  } = params;

  const billsRatio = monthlyPay > 0 ? billsCommitted / monthlyPay : 0;

  const lowSafeToSpend =
    financialStatus === "overspending" ||
    safeToSpend <= 0 ||
    financialStatus === "tight" ||
    financialStatus === "improving" ||
    (monthlyPay > 0 && safeToSpend < monthlyPay * 0.06);

  const highBillsRatio = monthlyPay > 0 && billsRatio >= 0.42;

  const strongSurplus =
    financialStatus !== "overspending" &&
    financialStatus !== "tight" &&
    financialStatus !== "improving" &&
    monthlyPay > 0 &&
    safeToSpend >= monthlyPay * 0.14 &&
    savingsRatePercent < 20;

  const ordered: OverviewNextAction[] = [];

  if (lowSafeToSpend) {
    ordered.push({
      id: "reduce-discretionary",
      title: "Reduce discretionary spending",
      detail:
        daysUntilPayday > 0
          ? `Safe to spend is tight with ${daysUntilPayday} day${daysUntilPayday === 1 ? "" : "s"} until payday—delay non-essentials you can move.`
          : "Safe to spend is tight—trim non-essential purchases until you replenish.",
      primaryHref: "/expenses",
      primaryLabel: "Review expenses",
    });
  }

  if (ordered.length < 2 && highBillsRatio) {
    ordered.push({
      id: "review-recurring",
      title: "Review recurring expenses",
      detail: `Bills due before payday are about ${Math.round(billsRatio * 100)}% of monthly take-home—subscriptions and fixed dates add up fast.`,
      primaryHref: "/bills",
      primaryLabel: "View bills",
    });
  }

  if (ordered.length < 2 && strongSurplus) {
    ordered.push({
      id: "increase-savings",
      title: "Increase savings or investments",
      detail: `You have meaningful headroom with a combined ${Math.round(savingsRatePercent)}% save + invest rate—consider nudging goals while cushion is strong.`,
      primaryHref: "/goals",
      primaryLabel: "Adjust goals",
    });
  }

  if (ordered.length === 0) {
    ordered.push({
      id: "maintain-rhythm",
      title: "Keep your rhythm",
      detail:
        "Your cushion and commitments look balanced—keep logging expenses and watching due dates.",
      primaryHref: "/expenses",
      primaryLabel: "Log expenses",
    });
  }

  return ordered.slice(0, 2);
}
