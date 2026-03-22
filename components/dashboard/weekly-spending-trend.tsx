"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { WeekOverWeekTrend } from "@/lib/expense-dashboard-summaries";

type Props = {
  trend: WeekOverWeekTrend;
};

/**
 * Rolling windows (same as `weekOverWeekTrend` in lib):
 * “This week” = last 7 local days including today; “last week” = the 7 days before that.
 */
export default function WeeklySpendingTrend({ trend }: Props) {
  const max = Math.max(trend.thisWeek, trend.lastWeek, 1);
  const wThis = (trend.thisWeek / max) * 100;
  const wLast = (trend.lastWeek / max) * 100;

  const headline = (() => {
    if (trend.direction === "none" && trend.thisWeek <= 0) {
      return (
        <span className="text-slate-300">
          Log expenses to see whether spending is improving week over week.
        </span>
      );
    }
    if (trend.pctChange == null || trend.lastWeek <= 0) {
      if (trend.thisWeek > 0) {
        return (
          <>
            You spent{" "}
            <span className="font-semibold tabular-nums text-white">
              {formatMoney(trend.thisWeek)}
            </span>{" "}
            in the last 7 days. Next week we&apos;ll compare to this stretch.
          </>
        );
      }
      return (
        <span className="text-slate-300">No spending in the last 7 days.</span>
      );
    }
    if (trend.direction === "same") {
      return (
        <span className="text-slate-200">
          Spending is about the same as the week before.
        </span>
      );
    }
    const pct = Math.abs(Math.round(trend.pctChange));
    if (trend.direction === "up") {
      return (
        <span className="text-amber-100">
          Spending is up{" "}
          <span className="font-semibold tabular-nums">{pct}%</span> this week
        </span>
      );
    }
    return (
      <span className="text-emerald-100">
        Spending is down{" "}
        <span className="font-semibold tabular-nums">{pct}%</span> this week
      </span>
    );
  })();

  const upColor = "bg-amber-500/80";
  const downColor = "bg-emerald-500/80";
  const neutralColor = "bg-sky-500/70";

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-slate-950/45 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition duration-300 ease-out hover:border-white/[0.12] hover:shadow-[0_12px_36px_-20px_rgba(0,0,0,0.55)] sm:p-5"
      aria-label="Weekly spending trend"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Weekly trend
          </p>
          <p className="text-base font-medium leading-snug sm:text-lg">{headline}</p>
          <p className="text-xs text-slate-500">
            Last 7 days vs the 7 days before (rolling windows).
          </p>
        </div>

        <div className="w-full shrink-0 space-y-3 lg:max-w-[220px]">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Last 7 days</span>
              <span className="font-medium tabular-nums text-slate-300">
                {formatMoney(trend.thisWeek)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800/80">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                  trend.direction === "up"
                    ? upColor
                    : trend.direction === "down"
                      ? downColor
                      : neutralColor
                }`}
                style={{ width: `${wThis}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>Prior 7 days</span>
              <span className="font-medium tabular-nums text-slate-300">
                {formatMoney(trend.lastWeek)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800/80">
              <div
                className="h-full rounded-full bg-slate-500/70 transition-[width] duration-500 ease-out"
                style={{ width: `${wLast}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
