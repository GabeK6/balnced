"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlanTier } from "@/lib/plan";
import { fetchUserPlanAccess, type PlanAccessState } from "@/lib/plan-access";

/**
 * Live client source of truth for Pro / trial access (user_plans + ensure_user_plan RPC).
 * Use this for UI gating — do not use `loadDashboardData().hasProAccess` for long-lived gating;
 * that snapshot is for server/data loaders only.
 *
 * `isPro` / `hasProAccess` reflect effective Pro feature access (trial or paid).
 */
export function useUserPlan() {
  const [planAccess, setPlanAccess] = useState<PlanAccessState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPlanAccess(null);
      setLoading(false);
      return;
    }
    const next = await fetchUserPlanAccess(supabase);
    setPlanAccess(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const next = await fetchUserPlanAccess(supabase);
      if (!cancelled) {
        setPlanAccess(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void refresh();
      }, 300);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVis);
      if (t) clearTimeout(t);
    };
  }, [refresh]);

  const plan: PlanTier = planAccess?.plan ?? "free";
  const hasProAccess = planAccess?.hasProAccess ?? false;

  return {
    plan,
    loading,
    /** Effective access to Pro-only features (trial or subscription). */
    hasProAccess,
    /** @deprecated Prefer hasProAccess — same value. */
    isPro: hasProAccess,
    planAccess,
    refresh,
  };
}
