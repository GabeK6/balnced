"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PlanTier } from "@/lib/plan";
import { fetchUserPlanAccess, type PlanAccessState } from "@/lib/plan-access";

/**
 * Live client source of truth for Pro / trial access (`public.user_plans` + `ensure_user_plan` RPC).
 *
 * - **Gating:** use `hasProAccess` (and `loading`) for locked/unlocked UI. Same rules as
 *   `computeProAccessFromRow` in `lib/plan-access.ts`.
 * - **Do not** use `loadDashboardData().hasProAccess` for long-lived gating — that snapshot is for
 *   server/data loaders only (`lib/dashboard-data.ts`).
 *
 * `isPro` is deprecated alias for `hasProAccess`.
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

  /** Re-fetch plan after login, token refresh, or sign-out so UI matches `user_plans`. */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setPlanAccess(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session?.user) {
          setLoading(true);
          void fetchUserPlanAccess(supabase).then((next) => {
            setPlanAccess(next);
            setLoading(false);
          });
        }
      }
    });
    return () => subscription.unsubscribe();
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
