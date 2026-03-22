"use client";

import type { ReactNode } from "react";

export type BillItemCardStatus = "overdue" | "upcoming" | "paid";

type Props = {
  status: BillItemCardStatus;
  name: string;
  category?: string | null;
  /** Primary due line (e.g. weekday + date). */
  dueDateDisplay: string;
  /** Timing vs today: "Due in 3 days", "3 days late", or paid context. */
  relativeHint?: string | null;
  amountDisplay: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Paid-style strikethrough on title. */
  nameMuted?: boolean;
  className?: string;
  /** Days until due (negative = overdue). Styles upcoming “Due today / tomorrow” pills. */
  deltaDays?: number;
};

const statusConfig: Record<
  BillItemCardStatus,
  { badge: string; badgeText: string; shell: string; statusDot: string }
> = {
  overdue: {
    badge: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-500/35",
    badgeText: "Overdue",
    shell:
      "border-l-[3px] border-l-rose-500 bg-rose-950/20 shadow-sm ring-1 ring-rose-500/15",
    statusDot: "bg-rose-400",
  },
  upcoming: {
    badge: "bg-slate-600/25 text-slate-200 ring-1 ring-white/10",
    badgeText: "Upcoming",
    shell:
      "border-l-[3px] border-l-slate-500/50 bg-slate-900/40 shadow-sm ring-1 ring-white/[0.06]",
    statusDot: "bg-slate-400",
  },
  paid: {
    badge: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/35",
    badgeText: "Paid",
    shell:
      "border-l-[3px] border-l-emerald-500 bg-emerald-950/20 shadow-sm ring-1 ring-emerald-500/20",
    statusDot: "bg-emerald-400",
  },
};

function timingPillClass(status: BillItemCardStatus, deltaDays?: number): string {
  if (status === "paid") {
    return "border-emerald-500/35 bg-emerald-950/35 text-emerald-100";
  }
  if (status === "overdue") {
    return "border-rose-500/40 bg-rose-950/40 text-rose-100";
  }
  if (deltaDays != null && deltaDays >= 0 && deltaDays <= 1) {
    return "border-emerald-500/40 bg-emerald-950/40 text-emerald-100";
  }
  return "border-slate-500/25 bg-slate-900/50 text-slate-300";
}

export default function BillItemCard({
  status,
  name,
  category,
  dueDateDisplay,
  relativeHint,
  amountDisplay,
  leading,
  trailing,
  nameMuted = false,
  className = "",
  deltaDays,
}: Props) {
  const cfg = statusConfig[status];
  const cat = category?.trim() || "";
  const categoryShown = cat || "Uncategorized";

  return (
    <div
      className={`rounded-xl p-4 motion-safe:transition-shadow motion-safe:duration-200 motion-safe:hover:shadow-lg motion-safe:hover:shadow-black/20 motion-reduce:transition-none ${cfg.shell} ${className}`}
    >
      <div className="flex gap-3">
        {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span
                  className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${cfg.statusDot}`}
                  aria-hidden
                />
                <h3
                  className={`min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-slate-50 ${
                    nameMuted ? "line-through opacity-70" : ""
                  }`}
                >
                  {name}
                </h3>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}
                >
                  {cfg.badgeText}
                </span>
              </div>
              <p
                className={`mt-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                  cat ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {categoryShown}
              </p>
              {relativeHint ? (
                <p
                  className={`mt-2 inline-flex max-w-full rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums ${timingPillClass(status, deltaDays)}`}
                >
                  {relativeHint}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <p className="text-lg font-bold tabular-nums tracking-tight text-white sm:text-right">
                {amountDisplay}
              </p>
              {trailing ? (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">{trailing}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              Due date
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums leading-snug text-slate-50 sm:text-lg">
              {dueDateDisplay}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
