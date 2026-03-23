"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardShell from "@/components/dashboard/shell";

function SubscriptionCheckoutMessage() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");

  if (checkout === "success") {
    return (
      <div
        className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100/95"
        role="status"
      >
        Checkout completed. Finalizing your subscription…
        <p className="mt-2 text-xs leading-relaxed text-emerald-200/70">
          It may take a moment for Pro access to appear everywhere while we confirm payment with Stripe.
        </p>
      </div>
    );
  }

  if (checkout === "cancel") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-slate-900/40 px-4 py-3 text-sm text-slate-300" role="status">
        Checkout was canceled.
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-slate-400">
      Manage your plan and billing on the{" "}
      <Link href="/settings/subscription" className="font-medium text-emerald-400 hover:text-emerald-300">
        Subscription
      </Link>{" "}
      page in settings.
    </p>
  );
}

export default function SubscriptionReturnPage() {
  return (
    <DashboardShell
      title="Subscription"
      subtitle="Plan and checkout status."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="balnced-panel mx-auto max-w-lg space-y-6 rounded-2xl p-6 sm:p-8">
        <Suspense
          fallback={<p className="text-sm text-slate-500">Loading…</p>}
        >
          <SubscriptionCheckoutMessage />
        </Suspense>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/settings/subscription"
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-500"
          >
            Subscription settings
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-xl border border-white/10 px-4 py-2.5 font-semibold text-slate-200 transition hover:bg-white/[0.06]"
          >
            Overview
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
