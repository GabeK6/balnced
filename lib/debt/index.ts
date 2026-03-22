/**
 * Debt domain — types, metrics, payoff strategies, planning contracts, and insights.
 *
 * **Add features here** (snowball/avalanche UI, timelines, extra-payment sims) instead of
 * scattering helpers across components. `runPayoffSimulation` is the future home for
 * amortization; `buildMonthlyDebtInsights` can incorporate budget + AI later.
 */

export * from "@/lib/debt-types";
export * from "@/lib/debt-metrics";
export * from "@/lib/debt/strategies";
export * from "@/lib/debt/planning";
export * from "@/lib/debt/insights";
