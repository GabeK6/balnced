import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanTier } from "@/lib/plan";
import { parsePlanTier } from "@/lib/plan";

/** Mirrors `public.user_plans.subscription_status` check constraint. */
export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type PlanAccessState = {
  plan: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  /** True when user may use Pro-only features (trial or paid). */
  hasProAccess: boolean;
  /** Trialing and trial_ends_at is in the future (server time after ensure_user_plan). */
  isTrialActive: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  /** Full days left in trial (ceil); null if not in active trial. */
  trialDaysRemaining: number | null;
  /** Useful in last 24h; null if not in active trial. */
  trialHoursRemaining: number | null;
  /** Had a trial window that has ended and no paid Pro access. */
  trialExpiredWithoutSubscription: boolean;
};

export function parseSubscriptionStatus(raw: unknown): SubscriptionStatus {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    s === "inactive" ||
    s === "trialing" ||
    s === "active" ||
    s === "past_due" ||
    s === "canceled"
  ) {
    return s;
  }
  return "inactive";
}

/**
 * Server and client: Pro feature access from a user_plans row.
 * Call `ensure_user_plan` RPC first so trialing rows past trial_ends_at are expired.
 */
export function computeProAccessFromRow(
  row: Record<string, unknown> | null | undefined,
  nowMs: number
): boolean {
  if (!row) return false;
  const status = parseSubscriptionStatus(row.subscription_status);
  const plan = parsePlanTier(row.plan);
  const trialEndRaw = row.trial_ends_at;
  const trialEndMs =
    trialEndRaw != null && String(trialEndRaw).length > 0
      ? Date.parse(String(trialEndRaw))
      : NaN;

  if (status === "trialing" && Number.isFinite(trialEndMs) && trialEndMs > nowMs) {
    return true;
  }
  if (plan === "pro" && (status === "active" || status === "past_due")) {
    return true;
  }
  return false;
}

function ceilDays(ms: number): number {
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function ceilHours(ms: number): number {
  return Math.max(0, Math.ceil(ms / 3_600_000));
}

/** Readable string for Supabase Postgrest errors (avoids `{}` in logs when props are non-enumerable). */
function formatPostgrestError(err: unknown): string {
  if (err == null) return "unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const keys = ["message", "code", "details", "hint", "statusCode"] as const;
    const parts = keys
      .map((k) => (o[k] != null && o[k] !== "" ? `${k}=${String(o[k])}` : null))
      .filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      const json = JSON.stringify(o);
      if (json !== "{}") return json;
    } catch {
      /* fall through */
    }
    const names = Object.getOwnPropertyNames(err);
    if (names.length) {
      return names
        .map((k) => `${k}=${String((err as Record<string, unknown>)[k])}`)
        .join(" | ");
    }
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isPlanAccessDebugEnabled(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEBUG_PLAN_ACCESS === "1"
  );
}

/** Use warn (not error) so Next.js dev overlay does not treat recoverable plan fetch issues as fatal. */
function logPlanAccessWarning(scope: string, err: unknown): void {
  const detail = formatPostgrestError(err);
  if (detail === "{}" || detail.length < 3) {
    console.warn(
      `[balnced] ${scope}: Supabase returned an error without a message. Apply migrations for user_plans + ensure_user_plan RPC, and RLS policies on public.user_plans.`
    );
    return;
  }
  console.warn(`[balnced] ${scope}:`, detail);
}

function trialWindowOpen(
  subscriptionStatus: SubscriptionStatus,
  trialEndsAt: string | null,
  nowMs: number
): boolean {
  if (subscriptionStatus !== "trialing") return false;
  if (!trialEndsAt) return false;
  const trialEndMs = Date.parse(trialEndsAt);
  return Number.isFinite(trialEndMs) && trialEndMs > nowMs;
}

export function rowToPlanAccessState(
  row: Record<string, unknown> | null | undefined,
  nowMs: number
): PlanAccessState {
  const empty: PlanAccessState = {
    plan: "free",
    subscriptionStatus: "inactive",
    hasProAccess: false,
    isTrialActive: false,
    trialStartedAt: null,
    trialEndsAt: null,
    trialDaysRemaining: null,
    trialHoursRemaining: null,
    trialExpiredWithoutSubscription: false,
  };
  if (!row) return empty;

  const subscriptionStatus = parseSubscriptionStatus(row.subscription_status);
  const plan = parsePlanTier(row.plan);
  const trialStartedAt =
    row.trial_started_at != null && String(row.trial_started_at).length > 0
      ? String(row.trial_started_at)
      : null;
  const trialEndsAt =
    row.trial_ends_at != null && String(row.trial_ends_at).length > 0
      ? String(row.trial_ends_at)
      : null;
  const trialEndMs = trialEndsAt ? Date.parse(trialEndsAt) : NaN;

  const hasProAccess = computeProAccessFromRow(row, nowMs);
  const isTrialActive = trialWindowOpen(subscriptionStatus, trialEndsAt, nowMs);

  let trialDaysRemaining: number | null = null;
  let trialHoursRemaining: number | null = null;
  if (isTrialActive && Number.isFinite(trialEndMs)) {
    const left = trialEndMs - nowMs;
    trialDaysRemaining = ceilDays(left);
    trialHoursRemaining = ceilHours(left);
  }

  const trialExpiredWithoutSubscription =
    !hasProAccess &&
    plan === "free" &&
    trialStartedAt != null &&
    trialEndsAt != null &&
    Number.isFinite(trialEndMs) &&
    trialEndMs <= nowMs;

  return {
    plan,
    subscriptionStatus,
    hasProAccess,
    isTrialActive,
    trialStartedAt,
    trialEndsAt,
    trialDaysRemaining,
    trialHoursRemaining,
    trialExpiredWithoutSubscription,
  };
}

/** True when trial window is still open (trialing + future trial_ends_at). */
export function isTrialWindowActive(
  planAccess: PlanAccessState | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!planAccess) return false;
  return trialWindowOpen(planAccess.subscriptionStatus, planAccess.trialEndsAt, nowMs);
}

/**
 * Short suffix for trial badges: "7d left", "1d left", "ends today", or "expired".
 * Only meaningful when the trial window is still active; callers may gate on isTrialWindowActive.
 */
export function formatTrialRemainingShort(
  planAccess: PlanAccessState | null | undefined,
  nowMs: number = Date.now()
): string {
  if (!planAccess?.trialEndsAt) return "expired";
  const end = Date.parse(planAccess.trialEndsAt);
  if (!Number.isFinite(end)) return "expired";
  const leftMs = end - nowMs;
  if (leftMs <= 0) return "expired";
  const daysCeil = Math.ceil(leftMs / 86_400_000);
  const endDay = new Date(end);
  const nowDay = new Date(nowMs);
  const sameCalDay =
    endDay.getFullYear() === nowDay.getFullYear() &&
    endDay.getMonth() === nowDay.getMonth() &&
    endDay.getDate() === nowDay.getDate();
  if (daysCeil === 1 && sameCalDay) return "ends today";
  if (daysCeil === 1) return "1d left";
  return `${daysCeil}d left`;
}

/** Subscribe / upgrade CTA when user has no Pro access and is not in an active trial window. */
export function shouldShowSubscribeCta(planAccess: PlanAccessState | null | undefined): boolean {
  if (!planAccess) return true;
  if (planAccess.hasProAccess) return false;
  if (isTrialWindowActive(planAccess)) return false;
  return true;
}

/** Paid Pro (Stripe-backed or manual pro row), not trialing free. */
export function isPaidProAccount(planAccess: PlanAccessState | null): boolean {
  if (!planAccess) return false;
  return (
    planAccess.plan === "pro" &&
    (planAccess.subscriptionStatus === "active" || planAccess.subscriptionStatus === "past_due")
  );
}

/** Navbar trial chip text, or null if not in an active trial window. */
export function navTrialBadgeText(planAccess: PlanAccessState | null): string | null {
  if (!planAccess || !isTrialWindowActive(planAccess)) return null;
  return `Pro trial · ${formatTrialRemainingShort(planAccess)}`;
}

/**
 * Upgrade modal headline when the user is in an active trial (matches formatTrialRemainingShort).
 */
export function trialEndHeadlineForModal(planAccess: PlanAccessState | null): string | null {
  if (!planAccess || !isTrialWindowActive(planAccess)) return null;
  const s = formatTrialRemainingShort(planAccess);
  if (s === "expired") return null;
  if (s === "ends today") return "Your free trial ends today";
  if (s === "1d left") return "Your free trial ends in 1 day";
  const m = /^(\d+)d left$/.exec(s);
  if (m) return `Your free trial ends in ${m[1]} days`;
  return "Your free trial is active";
}

/** Settings / account summary: Free trial, Paid Pro, Free, or trial expired. */
export function getPlanAccountStatusLabel(planAccess: PlanAccessState | null): string {
  if (!planAccess) return "Free";
  if (isTrialWindowActive(planAccess)) return "Free trial";
  if (isPaidProAccount(planAccess)) return "Paid Pro";
  if (planAccess.trialExpiredWithoutSubscription) return "Free · trial expired";
  return "Free";
}

/** Fetches user_plans after ensure_user_plan (call from authenticated Supabase client). */
export async function fetchUserPlanAccess(
  supabase: SupabaseClient
): Promise<PlanAccessState | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const debug = isPlanAccessDebugEnabled();
  if (debug) {
    console.warn("[balnced] fetchUserPlanAccess: auth user id =", user.id);
  }

  const { error: rpcErr } = await supabase.rpc("ensure_user_plan");
  if (rpcErr) {
    logPlanAccessWarning("ensure_user_plan RPC", rpcErr);
  }
  if (debug) {
    console.warn(
      "[balnced] ensure_user_plan:",
      rpcErr ? `failed (${formatPostgrestError(rpcErr)})` : "ok (void)"
    );
  }

  const { data, error } = await supabase
    .from("user_plans")
    .select(
      "user_id, plan, subscription_status, trial_started_at, trial_ends_at, updated_at, stripe_customer_id, stripe_subscription_id"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logPlanAccessWarning("user_plans select", error);
    if (debug) {
      console.warn(
        "[balnced] user_plans select failed:",
        formatPostgrestError(error),
        "user_id =",
        user.id
      );
    }
    return rowToPlanAccessState(null, Date.now());
  }

  if (debug) {
    console.warn(
      "[balnced] user_plans select:",
      data ? "ok (row)" : "ok (no row)",
      data ? { plan: data.plan, subscription_status: data.subscription_status } : null
    );
  }

  return rowToPlanAccessState(
    (data ?? null) as Record<string, unknown> | null,
    Date.now()
  );
}
