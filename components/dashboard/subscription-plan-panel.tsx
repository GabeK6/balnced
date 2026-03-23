"use client";

import { useState } from "react";
import type { PlanAccessState } from "@/lib/plan-access";
import {
  formatTrialRemainingShort,
  getPlanAccountStatusLabel,
  isTrialWindowActive,
  shouldShowSubscribeCta,
} from "@/lib/plan-access";
import { PRO_MONTHLY_LABEL } from "@/lib/plan";
import { UPGRADE_CONTEXT_HEADLINE } from "@/lib/upgrade-prompt";
import { createCheckoutSessionForPro } from "@/lib/stripe-checkout-client";

type Props = {
  planAccess: PlanAccessState | null;
  planLoading: boolean;
  /** Set by server from `STRIPE_PRICE_PRO_MONTHLY` — never read env in this client component. */
  hasStripePriceConfigured?: boolean;
};

/**
 * Plan status, billing copy, and upgrade CTA — used on `/settings/subscription`.
 */
export function SubscriptionPlanPanel({
  planAccess,
  planLoading,
  hasStripePriceConfigured = true,
}: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function upgradeToPro() {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const result = await createCheckoutSessionForPro();
      if (!result.ok) {
        setCheckoutError(result.error);
        return;
      }
      window.location.assign(result.url);
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-white/[0.08] bg-slate-900/35 p-4 sm:p-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Current plan
        </p>
        <p className="mt-1.5 text-sm font-medium text-slate-200">
          {planLoading ? "…" : getPlanAccountStatusLabel(planAccess)}
        </p>
        {!planLoading && planAccess && isTrialWindowActive(planAccess) && planAccess.trialEndsAt ? (
          <p className="mt-1 text-xs text-amber-200/90">
            Trial ends{" "}
            {new Date(planAccess.trialEndsAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {` · ${formatTrialRemainingShort(planAccess)}`}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{UPGRADE_CONTEXT_HEADLINE}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Pro adds Copilot, projections, goal simulations, and deeper insights — {PRO_MONTHLY_LABEL} at
          launch.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          Subscription billing is powered by Stripe Checkout.
        </p>
        {!hasStripePriceConfigured ? (
          <p className="mt-3 text-sm text-slate-500">
            Checkout is not configured on the server yet. Add{" "}
            <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.8rem] text-slate-400">
              STRIPE_PRICE_PRO_MONTHLY
            </code>{" "}
            to your environment and restart the dev server.
          </p>
        ) : null}
        {checkoutError ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {checkoutError}
          </p>
        ) : null}
        {!planLoading && shouldShowSubscribeCta(planAccess) ? (
          <button
            type="button"
            onClick={() => void upgradeToPro()}
            disabled={checkoutLoading || !hasStripePriceConfigured}
            className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(5,150,105,0.4)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkoutLoading
              ? "Redirecting…"
              : planAccess?.trialExpiredWithoutSubscription
                ? "Subscribe"
                : "Upgrade to Pro"}
          </button>
        ) : null}
      </div>
    </>
  );
}
