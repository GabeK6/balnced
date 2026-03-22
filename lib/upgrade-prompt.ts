/**
 * Contextual upgrade copy — one headline + per-surface detail lines.
 * Keep tone calm; avoid urgency or countdown language.
 */
export const UPGRADE_CONTEXT_HEADLINE =
  "Unlock AI insights to optimize your finances.";

export type UpgradePromptSurface =
  | "copilot"
  | "projection"
  | "overview_money_flow"
  | "overview_payday"
  | "goals_sim"
  | "goals_ai"
  | "retirement"
  | "investments"
  | "expenses";

/** Short line explaining what Pro adds for this surface (shown under the headline). */
export function upgradeDetailForSurface(surface: UpgradePromptSurface): string {
  switch (surface) {
    case "copilot":
      return "Chat with Copilot and run affordability checks on your real numbers.";
    case "projection":
      return "See the full chart, timeline, and pay schedule forecast.";
    case "overview_money_flow":
      return "See income, bills, savings, and spending in one view.";
    case "overview_payday":
      return "Preview your balance path through payday.";
    case "goals_sim":
      return "Slide a monthly rate to see how funding shifts your goal dates.";
    case "goals_ai":
      return "Get short, tailored ideas for ordering and funding goals.";
    case "retirement":
      return "Benchmarks, contribution what-ifs, and AI coaching.";
    case "investments":
      return "Turn your plan into a personalized investing narrative.";
    case "expenses":
      return "Smart categories, monthly budgets, trend charts, and a clearer daily spending limit.";
    default:
      return "";
  }
}

export function isProRequiredApiError(error: unknown): boolean {
  return error === "PRO_REQUIRED";
}

/** Inline assistant message when the server returns 403 PRO_REQUIRED (stale plan, etc.). */
export function proRequiredFriendlyMessage(): string {
  return `${UPGRADE_CONTEXT_HEADLINE} Balnced Pro includes this — refresh after upgrading, or check Settings → Plan.`;
}
