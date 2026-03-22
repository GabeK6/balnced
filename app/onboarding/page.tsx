"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboarding-state";
import IncomeBalanceForm from "@/components/onboarding/income-balance-form";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

/**
 * First-time users: 4-step `OnboardingWizard` (Income → Bills → Goals → Preferences) until budget + payday exist.
 * Returning users: `IncomeBalanceForm` (navbar “Income & balance”).
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [useWizard, setUseWizard] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: budget } = await supabase
        .from("budgets")
        .select("id, next_payday")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const hasPayday =
        budget?.id &&
        budget.next_payday != null &&
        String(budget.next_payday).trim() !== "";

      if (!cancelled) {
        if (hasPayday) {
          if (!hasCompletedOnboarding(user.id)) {
            markOnboardingComplete(user.id);
          }
          setUseWizard(false);
        } else {
          setUseWizard(true);
        }
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="balnced-panel rounded-3xl p-6">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  return useWizard ? <OnboardingWizard /> : <IncomeBalanceForm />;
}
