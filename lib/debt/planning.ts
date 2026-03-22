import type { Debt } from "@/lib/debt-types";
import type { PayoffStrategyKind } from "@/lib/debt/strategies";
import { orderDebtIdsForPayoffStrategy } from "@/lib/debt/strategies";

/**
 * Future: compounding model, payment timing, promo APR windows, fees.
 * Extend this object as simulations gain fidelity — keep fields optional for backward compatibility.
 */
export type PayoffSimulationAssumptions = {
  /** How APR is applied each month (default in future impl: simple monthly). */
  interestMethod?: "apr_simple_monthly";
};

/**
 * Input for payoff timeline + “extra payment” scenarios (snowball / avalanche routing).
 * Not all fields are used until `runPayoffSimulation` is fully implemented.
 */
export type PayoffSimulationInput = {
  debts: Debt[];
  /** Additional cash beyond minimums applied each month toward the active target debt. */
  extraPaymentPerMonth: number;
  strategy: PayoffStrategyKind;
  assumptions?: PayoffSimulationAssumptions;
};

/**
 * One row in a future month-by-month schedule (principal, interest, balance).
 */
export type PayoffMonthProjection = {
  monthIndex: number;
  /** Which debt received the “snowball/avalanche” rollover this month */
  activeDebtId: string | null;
  balancesByDebtId: Record<string, number>;
  interestAccruedTotal: number;
  principalPaidTotal: number;
};

export type PayoffSimulationResult = {
  /**
   * `stub` — ordering is real; amortization / months-to-payoff not computed yet.
   * `simulated` — reserved for when schedule math ships.
   */
  status: "stub" | "simulated";
  strategy: PayoffStrategyKind;
  /** Always populated: payoff sequence for the chosen strategy. */
  payoffOrderDebtIds: string[];
  /** Populated when status === `simulated`; otherwise null. */
  monthlySchedule: PayoffMonthProjection[] | null;
  monthsToDebtFree: number | null;
  totalInterestPaidEstimate: number | null;
  /** Notes for UI / debugging while the engine is partial. */
  notes: string[];
};

/**
 * Contract for payoff timeline + extra-payment modeling.
 * Today: returns strategy order + explicit stub fields so callers can branch safely.
 * Tomorrow: fill `monthlySchedule`, `monthsToDebtFree`, and `totalInterestPaidEstimate`.
 */
export function runPayoffSimulation(input: PayoffSimulationInput): PayoffSimulationResult {
  const order = orderDebtIdsForPayoffStrategy(input.debts, input.strategy);
  const extra = Math.max(0, Number(input.extraPaymentPerMonth) || 0);

  return {
    status: "stub",
    strategy: input.strategy,
    payoffOrderDebtIds: order,
    monthlySchedule: null,
    monthsToDebtFree: null,
    totalInterestPaidEstimate: null,
    notes: [
      "Amortization and timeline are not computed yet — payoff order is ready for snowball/avalanche.",
      extra > 0
        ? `Extra payment of ${extra.toFixed(2)}/mo will roll into simulation once schedules are implemented.`
        : "Add extraPaymentPerMonth to model accelerated payoff when simulation ships.",
    ],
  };
}
