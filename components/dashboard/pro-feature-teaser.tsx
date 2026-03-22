"use client";

import { useState } from "react";
import UpgradeModal from "@/components/dashboard/upgrade-modal";
import { useUserPlan } from "@/hooks/use-user-plan";
import {
  UPGRADE_CONTEXT_HEADLINE,
  upgradeDetailForSurface,
  type UpgradePromptSurface,
} from "@/lib/upgrade-prompt";

type Props = {
  title: string;
  /** Overrides automatic detail from `surface`. */
  description?: string;
  /** When set, detail line defaults from contextual copy unless `description` is set. */
  surface?: UpgradePromptSurface;
  className?: string;
  /**
   * `card` — centered paywall (default), matches Pro upgrade UI across the app.
   * `inline` — horizontal layout for tight toolbars or legacy rows.
   */
  variant?: "card" | "inline";
  /** When false, no UpgradeModal is mounted (caller handles upgrade UI). Default true. */
  withModal?: boolean;
  /** If set, “View Pro” calls this instead of opening the internal modal (implies withModal false in practice). */
  onOpenPro?: () => void;
};

/**
 * Standard Pro paywall card: violet border, gradient panel, centered copy, “View Pro” → UpgradeModal.
 */
export default function ProFeatureTeaser({
  title,
  description,
  surface,
  className = "",
  variant = "card",
  withModal = true,
  onOpenPro,
}: Props) {
  const [open, setOpen] = useState(false);
  const { planAccess, refresh, loading: planLoading } = useUserPlan();
  const detail =
    description ?? (surface ? upgradeDetailForSurface(surface) : undefined);

  const shellClass =
    variant === "card"
      ? "rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-slate-900/45 to-slate-950/60 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-8"
      : "rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 via-slate-900/40 to-slate-950/50 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]";

  const buttonClass =
    variant === "card"
      ? "mt-6 w-full max-w-[12rem] rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-500/20"
      : "shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20";

  function handleViewPro() {
    if (onOpenPro) {
      onOpenPro();
      return;
    }
    if (withModal) setOpen(true);
  }

  return (
    <>
      <div className={`${shellClass} ${className}`}>
        {variant === "card" ? (
          <div className="flex flex-col items-center text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-violet-400/95">
              Pro
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              {UPGRADE_CONTEXT_HEADLINE}
            </p>
            <p className="mt-3 text-base font-semibold tracking-tight text-slate-50 sm:text-lg">
              {title}
            </p>
            {detail ? (
              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">{detail}</p>
            ) : null}
            <button type="button" onClick={handleViewPro} className={buttonClass}>
              View Pro
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-violet-400/90">
                Pro
              </p>
              <p className="mt-2 text-sm leading-snug text-slate-300">{UPGRADE_CONTEXT_HEADLINE}</p>
              <p className="mt-2 text-sm font-medium text-slate-200">{title}</p>
              {detail ? (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{detail}</p>
              ) : null}
            </div>
            <button type="button" onClick={handleViewPro} className={buttonClass}>
              View Pro
            </button>
          </div>
        )}
      </div>
      {withModal ? (
        <UpgradeModal
          open={open}
          onClose={() => setOpen(false)}
          planAccess={planAccess}
          loadingPlan={planLoading}
          onRefresh={refresh}
        />
      ) : null}
    </>
  );
}
