import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { PlanTier } from "@/lib/plan";
import { parsePlanTier } from "@/lib/plan";
import { computeProAccessFromRow } from "@/lib/plan-access";

/**
 * Authoritative Pro gate for API routes (uses DB + ensure_user_plan with user JWT).
 */
export async function getProAccessForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { error: rpcErr } = await supabase.rpc("ensure_user_plan");
  if (rpcErr) {
    console.error("ensure_user_plan:", rpcErr);
  }
  const { data, error } = await supabase
    .from("user_plans")
    .select("user_id, plan, subscription_status, trial_started_at, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("user_plans:", error);
    return false;
  }
  return computeProAccessFromRow(
    (data ?? null) as Record<string, unknown> | null,
    Date.now()
  );
}

/** @deprecated Use getProAccessForUser — billing tier alone is not sufficient with trials. */
export async function getPlanForUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanTier> {
  const { data } = await supabase
    .from("user_plans")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  return parsePlanTier(data?.plan);
}

/** 403 JSON for authenticated users without Pro access (trial expired or free). */
export function proPlanRequiredResponse() {
  return NextResponse.json(
    {
      error: "PRO_REQUIRED",
      message: "This feature requires Balnced Pro (active trial or subscription).",
    },
    { status: 403 }
  );
}
