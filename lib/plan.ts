/** Subscription tier — persisted in `public.user_plans.plan`. */
export type PlanTier = "free" | "pro";

export const PRO_MONTHLY_LABEL = "$8/mo";

export function parsePlanTier(raw: unknown): PlanTier {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s === "pro" ? "pro" : "free";
}

export function isProPlan(plan: PlanTier | null | undefined): boolean {
  return plan === "pro";
}
