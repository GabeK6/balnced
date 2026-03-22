"use client";

import { useEffect, useState } from "react";
import { UPGRADE_CONTEXT_HEADLINE } from "@/lib/upgrade-prompt";

function storageKey(hintId: string): string {
  return `balnced_ctx_hint_${hintId}`;
}

type Props = {
  /** Stable id per surface (e.g. `projection`, `overview_projection_link`). */
  hintId: string;
  /** Extra context after the headline — keep short. */
  subline?: string;
  onOpenDetails?: () => void;
  className?: string;
};

/**
 * Dismissible strip using the same Pro / violet language as {@link ProFeatureTeaser}.
 */
export default function ContextualUpgradeHint({
  hintId,
  subline,
  onOpenDetails,
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (sessionStorage.getItem(storageKey(hintId))) return;
      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [hintId]);

  if (!visible) return null;

  return (
    <div
      role="note"
      className={`rounded-2xl border border-violet-500/35 bg-gradient-to-br from-violet-950/35 via-slate-900/40 to-slate-950/55 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:px-5 sm:py-3.5 ${className}`}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-violet-400/90">
            Pro
          </p>
          <p className="mt-1.5 text-[13px] leading-snug text-slate-300">
            <span className="font-medium text-slate-200">{UPGRADE_CONTEXT_HEADLINE}</span>
            {subline ? <span className="text-slate-500"> {subline}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onOpenDetails ? (
            <button
              type="button"
              onClick={onOpenDetails}
              className="rounded-lg border border-violet-500/35 bg-violet-500/10 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:border-violet-400/45 hover:bg-violet-500/20"
            >
              What&apos;s included
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem(storageKey(hintId), "1");
              } catch {
                /* ignore */
              }
              setVisible(false);
            }}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-400"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
