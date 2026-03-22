"use client";

import Link from "next/link";
import { UPGRADE_CONTEXT_HEADLINE } from "@/lib/upgrade-prompt";

type Props = {
  /** When true, children are blurred/disabled and overlay CTA is shown. */
  locked: boolean;
  children: React.ReactNode;
  title?: string;
};

/**
 * Post-trial gate — same visual language as {@link ProFeatureTeaser} (violet paywall card).
 */
export default function ProSubscribeGate({
  locked,
  children,
  title = "Pro feature",
}: Props) {
  if (!locked) return children;

  return (
    <div className="relative min-h-[8rem] overflow-hidden rounded-2xl">
      <div className="pointer-events-none max-h-[14rem] select-none blur-[3px] opacity-[0.4]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[3px] sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/40 via-slate-900/45 to-slate-950/60 p-6 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_24px_64px_-28px_rgba(0,0,0,0.85)] sm:p-8">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-violet-400/95">
            Pro
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{UPGRADE_CONTEXT_HEADLINE}</p>
          <p className="mt-3 text-base font-semibold tracking-tight text-slate-50 sm:text-lg">{title}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Subscribe to Balnced Pro to unlock this after your trial. Core tracking stays free.
          </p>
          <Link
            href="/settings"
            className="mt-6 inline-flex w-full max-w-[12rem] justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400/55 hover:bg-violet-500/20"
          >
            Subscribe to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
