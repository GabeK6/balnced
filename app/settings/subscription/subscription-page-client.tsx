"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import { supabase } from "@/lib/supabase";
import { useUserPlan } from "@/hooks/use-user-plan";
import { SubscriptionPlanPanel } from "@/components/dashboard/subscription-plan-panel";

type Props = {
  hasStripePriceConfigured: boolean;
};

export default function SubscriptionPageClient({ hasStripePriceConfigured }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const { loading: planLoading, planAccess } = useUserPlan();

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setAuthChecked(true);
    })();
  }, []);

  if (!authChecked) {
    return (
      <DashboardShell
        title="Subscription"
        subtitle="Loading…"
        backHref="/dashboard"
        backLabel="Back to Overview"
        compact
      >
        <p className="text-sm text-slate-500">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Subscription"
      subtitle="Your plan, trial status, and upgrade options."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="balnced-panel mx-auto max-w-lg space-y-6 rounded-2xl p-6 sm:p-8">
        <SubscriptionPlanPanel
          planAccess={planAccess}
          planLoading={planLoading}
          hasStripePriceConfigured={hasStripePriceConfigured}
        />

        <div className="rounded-xl border border-white/[0.06] bg-slate-950/40 p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
            What&apos;s included
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-400">
            <li>Financial Copilot and deeper projections</li>
            <li>Goal and retirement simulations</li>
            <li>Premium insights across Overview, Goals, and Retirement</li>
          </ul>
        </div>
      </div>
    </DashboardShell>
  );
}
