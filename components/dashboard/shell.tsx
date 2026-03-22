"use client";

import Link from "next/link";
import TrustFooter from "@/components/trust/trust-footer";
import Navbar from "./navbar";

export default function DashboardShell({
  title,
  subtitle,
  backHref,
  backLabel = "Back to Overview",
  compact = false,
  headerOverride,
  showTrustFooter = true,
  children,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  compact?: boolean;
  /** When set, replaces the back link + title panel row (e.g. custom breadcrumb). */
  headerOverride?: React.ReactNode;
  /** Subtle estimates / not-advice disclaimer at the bottom of the page. */
  showTrustFooter?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <Navbar />

      <div
        className={`w-full flex-1 overflow-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 ${
          compact ? "py-4" : "py-7"
        }`}
      >
        <div className={compact ? "flex h-full flex-col gap-4" : "space-y-5"}>
          {headerOverride ? (
            <div className="shrink-0">{headerOverride}</div>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-4">
              {backHref && (
                <Link
                  href={backHref}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition duration-150 ease-out hover:border-emerald-500/25 hover:bg-white/[0.07] motion-reduce:transition-none"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {backLabel}
                </Link>
              )}
              <div
                className={`balnced-panel min-w-0 flex-1 rounded-3xl ${
                  compact ? "p-4 sm:p-5" : "p-6 sm:p-7"
                }`}
              >
                <h1
                  className={`font-bold tracking-tight text-slate-50 ${
                    compact ? "text-lg sm:text-xl" : "text-2xl sm:text-[1.75rem]"
                  }`}
                >
                  {title}
                </h1>
                <p
                  className={`balnced-text-muted max-w-3xl leading-relaxed ${
                    compact ? "mt-1.5 text-sm" : "mt-2 text-sm sm:text-[0.9375rem]"
                  }`}
                >
                  {subtitle}
                </p>
              </div>
            </div>
          )}

          <div className={`${compact ? "min-h-0 flex-1" : ""} balnced-page-enter`}>{children}</div>
          {showTrustFooter ? <TrustFooter compact={compact} /> : null}
        </div>
      </div>
    </main>
  );
}
