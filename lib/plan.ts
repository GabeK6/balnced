/**
 * Subscription tier — persisted in `public.user_plans.plan`.
 * For **feature access**, use `computeProAccessFromRow` / `useUserPlan().hasProAccess` (`lib/plan-access.ts`);
 * `isProPlan` is only the tier string, not trial or canceled logic.
 */
export type PlanTier = "free" | "pro";

export const PRO_MONTHLY_LABEL = "$8/mo";

export function parsePlanTier(raw: unknown): PlanTier {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s === "pro" ? "pro" : "free";
}

/** True if tier is `pro` — does not imply feature access (see `lib/plan-access.ts`). */
export function isProPlan(plan: PlanTier | null | undefined): boolean {
  return plan === "pro";
}
