import type { Debt } from "@/lib/debt-types";
import type { DebtSnapshot } from "@/lib/debt-metrics";
import { orderDebtIdsForPayoffStrategy } from "@/lib/debt/strategies";
import type { PayoffStrategyKind } from "@/lib/debt/strategies";

/**
 * Monthly / contextual insights — rule-based today; AI or richer analytics can append later.
 */
export type DebtInsightKind =
  | "strategy_hint"
  | "interest_cost"
  | "payoff_order"
  | "stub";

export type DebtInsight = {
  id: string;
  kind: DebtInsightKind;
  title: string;
  body: string;
  /** Debts this insight references (for highlighting or future deep-links). */
  relatedDebtIds?: string[];
  /** Lower sorts first */
  priority: number;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Deterministic, cheap insights derived from snapshot + raw debts.
 * Future: merge with `runPayoffSimulation`, budget context, or AI endpoints.
 */
export function buildMonthlyDebtInsights(
  debts: Debt[],
  snapshot: DebtSnapshot,
  options?: { preferredStrategy?: PayoffStrategyKind }
): DebtInsight[] {
  const out: DebtInsight[] = [];
  const totalDebt = num(snapshot.totalDebt);
  if (debts.length === 0 || totalDebt <= 0) {
    return out;
  }

  const estInterest = num(snapshot.estimatedMonthlyInterest);
  if (estInterest > 0) {
    out.push({
      id: "interest-cost",
      kind: "interest_cost",
      title: "Estimated carrying cost",
      body: `At current balances and APRs, roughly ${estInterest.toFixed(2)} in interest may accrue this month if balances don’t drop — before any extra payments.`,
      priority: 10,
    });
  }

  const avalancheFirst = orderDebtIdsForPayoffStrategy(debts, "avalanche")[0];
  const snowballFirst = orderDebtIdsForPayoffStrategy(debts, "snowball")[0];
  if (avalancheFirst && snowballFirst && avalancheFirst !== snowballFirst) {
    const aName = debts.find((d) => d.id === avalancheFirst)?.name ?? "Debt";
    const sName = debts.find((d) => d.id === snowballFirst)?.name ?? "Debt";
    out.push({
      id: "strategy-divergence",
      kind: "strategy_hint",
      title: "Snowball vs avalanche",
      body: `Avalanche would prioritize “${aName}” first (APR). Snowball would start with “${sName}” (smallest balance). Both are valid — pick what you’ll stick with.`,
      relatedDebtIds: [avalancheFirst, snowballFirst].filter(Boolean),
      priority: 20,
    });
  } else if (avalancheFirst) {
    out.push({
      id: "payoff-order-avalanche",
      kind: "payoff_order",
      title: "Avalanche first target",
      body: `Highest APR is a sensible first focus: “${debts.find((d) => d.id === avalancheFirst)?.name ?? "Debt"}”.`,
      relatedDebtIds: [avalancheFirst],
      priority: 25,
    });
  }

  const pref = options?.preferredStrategy;
  if (pref) {
    const first = orderDebtIdsForPayoffStrategy(debts, pref)[0];
    if (first) {
      out.push({
        id: `preferred-${pref}`,
        kind: "stub",
        title: "Saved preference",
        body: `When payoff tools ship, we’ll align timelines and extra-payment sims with your ${pref === "snowball" ? "snowball" : "avalanche"} preference.`,
        relatedDebtIds: [first],
        priority: 90,
      });
    }
  }

  return out.sort((a, b) => a.priority - b.priority);
}
