import type { Debt } from "@/lib/debt-types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Canonical payoff strategies for future snowball / avalanche planners and simulations.
 * - **Snowball**: smallest balance first (psychological wins, frees minimum payments).
 * - **Avalanche**: highest APR first (minimizes interest vs minimum-only payments).
 */
export type PayoffStrategyKind = "snowball" | "avalanche";

/**
 * Ordered debt IDs for the given strategy. Use for UI lists, Copilot context, and simulation inputs.
 */
export function orderDebtIdsForPayoffStrategy(
  debts: Debt[],
  strategy: PayoffStrategyKind
): string[] {
  return orderDebtsForPayoffStrategy(debts, strategy).map((d) => d.id);
}

/**
 * Full `Debt` rows in payoff order (ties: lower id string last for stability).
 */
export function orderDebtsForPayoffStrategy(
  debts: Debt[],
  strategy: PayoffStrategyKind
): Debt[] {
  const copy = [...debts];
  if (strategy === "snowball") {
    copy.sort((a, b) => {
      const ba = num(a.balance);
      const bb = num(b.balance);
      if (ba !== bb) return ba - bb;
      return String(a.id).localeCompare(String(b.id));
    });
  } else {
    copy.sort((a, b) => {
      const aa = num(a.apr);
      const ab = num(b.apr);
      if (ab !== aa) return ab - aa;
      const ba = num(a.balance);
      const bb = num(b.balance);
      if (bb !== ba) return bb - ba;
      return String(a.id).localeCompare(String(b.id));
    });
  }
  return copy;
}

export function payoffStrategyLabel(strategy: PayoffStrategyKind): string {
  return strategy === "snowball" ? "Debt snowball" : "Debt avalanche";
}
