"use client";

import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";

/**
 * Non-Pro: blurred “preview” behind the standard Pro paywall card.
 */
export default function ExpensesProLockedSection() {
  return (
    <div className="relative min-h-[16rem] overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/40">
      <div
        className="pointer-events-none select-none space-y-4 p-6 opacity-35 blur-sm"
        aria-hidden
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-xl bg-slate-800/80" />
          <div className="h-40 rounded-full bg-slate-800/60" />
        </div>
        <div className="h-24 rounded-xl bg-slate-800/70" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-[3px] sm:p-6">
        <ProFeatureTeaser
          title="Pro Expenses"
          surface="expenses"
          className="w-full max-w-md shadow-[0_24px_64px_-28px_rgba(0,0,0,0.85)]"
        />
      </div>
    </div>
  );
}
