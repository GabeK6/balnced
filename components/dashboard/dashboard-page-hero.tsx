"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type DashboardHeroStat = {
  label: string;
  value: string;
  hint?: string;
};

const ACCENT = {
  emerald: {
    shell:
      "border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-slate-900/60 to-slate-950 shadow-[0_24px_64px_-28px_rgba(16,185,129,0.14)]",
    iconWrap: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    eyebrow: "text-emerald-200/80",
  },
  violet: {
    shell:
      "border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-slate-900/60 to-slate-950 shadow-[0_24px_64px_-28px_rgba(139,92,246,0.12)]",
    iconWrap: "border-violet-500/30 bg-violet-500/10 text-violet-200",
    eyebrow: "text-violet-200/80",
  },
  amber: {
    shell:
      "border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-slate-900/60 to-slate-950 shadow-[0_24px_64px_-28px_rgba(245,158,11,0.12)]",
    iconWrap: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    eyebrow: "text-amber-200/80",
  },
  cyan: {
    shell:
      "border-cyan-500/20 bg-gradient-to-br from-cyan-950/25 via-slate-900/60 to-slate-950 shadow-[0_24px_64px_-28px_rgba(6,182,212,0.12)]",
    iconWrap: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    eyebrow: "text-cyan-200/80",
  },
  slate: {
    shell:
      "border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-slate-950 shadow-[0_24px_64px_-32px_rgba(0,0,0,0.75)]",
    iconWrap: "border-white/10 bg-white/[0.06] text-slate-200",
    eyebrow: "text-slate-500",
  },
} as const;

export type DashboardPageHeroAccent = keyof typeof ACCENT;

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  accent?: DashboardPageHeroAccent;
  stats?: DashboardHeroStat[];
  /** Toolbar row below the hero (sort controls, primary CTA, etc.) */
  toolbar?: ReactNode;
};

export default function DashboardPageHero({
  eyebrow = "Overview",
  title,
  subtitle,
  icon: Icon,
  accent = "emerald",
  stats,
  toolbar,
}: Props) {
  const a = ACCENT[accent];

  return (
    <div className="space-y-6">
      <div
        className={`balnced-panel rounded-2xl border p-6 sm:p-8 ${a.shell}`}
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {Icon ? (
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${a.iconWrap}`}
                  aria-hidden
                >
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </div>
              ) : null}
              <div className="min-w-0">
                <p
                  className={`text-[0.65rem] font-semibold uppercase tracking-[0.14em] ${a.eyebrow}`}
                >
                  {eyebrow}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-[1.75rem]">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>

          {stats && stats.length > 0 ? (
            <div className="grid w-full shrink-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-[min(100%,42rem)] lg:gap-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm sm:p-5"
                >
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                    {s.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-slate-50 sm:text-xl">
                    {s.value}
                  </p>
                  {s.hint ? (
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">{s.hint}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {toolbar ? <div className="w-full">{toolbar}</div> : null}
    </div>
  );
}

/** Outer stack for dashboard pages: hero + sections */
export const DASHBOARD_PAGE_SECTION_GAP = "flex w-full flex-col gap-8 lg:gap-10";
