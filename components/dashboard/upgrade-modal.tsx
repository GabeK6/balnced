"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PRO_MONTHLY_LABEL } from "@/lib/plan";
import { UPGRADE_CONTEXT_HEADLINE } from "@/lib/upgrade-prompt";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";
import {
  isPaidProAccount,
  shouldShowSubscribeCta,
  trialEndHeadlineForModal,
  type PlanAccessState,
} from "@/lib/plan-access";

type Props = {
  open: boolean;
  onClose: () => void;
  /** From useUserPlan / loadDashboardData; drives trial vs subscribe copy. */
  planAccess?: PlanAccessState | null;
  loadingPlan?: boolean;
  /** Refresh plan when modal opens (e.g. parent useUserPlan.refresh). */
  onRefresh?: () => void | Promise<void>;
};

function formatTrialEnd(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function UpgradeModal({
  open,
  onClose,
  planAccess,
  loadingPlan = false,
  onRefresh,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !onRefresh) return;
    void onRefresh();
  }, [open, onRefresh]);

  if (!open || !mounted) return null;

  const trialEndLabel = formatTrialEnd(planAccess?.trialEndsAt ?? null);
  const trialHeadline = !loadingPlan && planAccess ? trialEndHeadlineForModal(planAccess) : null;
  const paidPro = !loadingPlan && planAccess ? isPaidProAccount(planAccess) : false;
  const needsSubscribe =
    !loadingPlan && planAccess ? shouldShowSubscribeCta(planAccess) : false;

  let headline = UPGRADE_CONTEXT_HEADLINE;
  let subline: string | null = null;
  if (loadingPlan) {
    headline = "Balnced Pro";
    subline = "Loading your plan…";
  } else if (paidPro) {
    headline = "You're on Balnced Pro";
    subline = "You have full access to Pro features. Manage billing from Settings when Stripe is connected.";
  } else if (trialHeadline) {
    headline = trialHeadline;
    subline =
      trialEndLabel !== ""
        ? `Full access until ${trialEndLabel}. Subscribe before your trial ends to keep Pro features without interruption.`
        : "Subscribe before your trial ends to keep Pro features without interruption.";
  } else if (needsSubscribe) {
    headline = "Subscribe to continue using Pro";
    subline =
      "Your trial has ended. Subscribe to keep AI Copilot, projections, simulations, and advanced retirement tools.";
  } else {
    subline = `Pro includes AI Copilot, cash projections, goal what-ifs, and deeper retirement insights — ${PRO_MONTHLY_LABEL} (launch pricing).`;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <button
        type="button"
        className="fixed inset-0 z-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 my-auto w-full max-w-md max-h-[min(90vh,90dvh)] min-h-0 overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0b1220]/98 p-6 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.85)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="balnced-eyebrow">Pro</p>
            <h2 id="upgrade-modal-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-50">
              {headline}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-400">{subline}</p>

        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-500">
          <li className="flex gap-2">
            <span className="text-emerald-500/90" aria-hidden>
              ✓
            </span>
            AI Copilot &amp; affordability checks
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500/90" aria-hidden>
              ✓
            </span>
            Projection &amp; overview cash runway views
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500/90" aria-hidden>
              ✓
            </span>
            Goal simulations &amp; AI strategy
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-500/90" aria-hidden>
              ✓
            </span>
            Retirement benchmarks &amp; AI guidance
          </li>
        </ul>

        <p className="mt-5 text-[11px] leading-relaxed text-slate-600">
          Core tracking (overview, bills, expenses) stays free. Paid billing connects via Stripe —
          subscribe when you&apos;re ready.
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{TRUST_DISCLAIMER}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] sm:w-auto"
          >
            {paidPro ? "Close" : needsSubscribe ? "Maybe later" : "Continue with Free"}
          </button>
          {paidPro ? (
            <Link
              href="/settings"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto"
              onClick={onClose}
            >
              Billing & settings
            </Link>
          ) : (
            <Link
              href="/settings"
              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:w-auto"
              onClick={onClose}
            >
              Subscribe to Pro
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
