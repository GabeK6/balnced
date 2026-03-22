"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { PaydayBalanceProjection } from "@/lib/overview-payday-projection";

type Props = {
  projection: PaydayBalanceProjection;
  /** e.g. "Mar 14" */
  paydayLabel: string;
};

/**
 * Forward-looking wallet estimate from month-to-date spending pace × days until payday.
 */
export default function OverviewPaydayProjection({ projection, paydayLabel }: Props) {
  const {
    projectedBalanceAtPayday,
    dailySpendPace,
    daysUntilPayday,
  } = projection;

  const shortfall = projectedBalanceAtPayday < 0;
  const absAmt = Math.abs(projectedBalanceAtPayday);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-4 shadow-[0_8px_32px_-18px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out hover:border-white/[0.12] hover:shadow-[0_14px_40px_-20px_rgba(0,0,0,0.65)] motion-reduce:transition-none sm:p-5">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
        End of period
      </p>
      <p className="mt-2 text-base font-semibold leading-snug text-slate-100 sm:text-lg">
        {daysUntilPayday <= 0 ? (
          <>
            At payday, wallet balance matches where you are now:{" "}
            <span className="font-bold tabular-nums text-white">
              {formatMoney(projectedBalanceAtPayday)}
            </span>
            .
          </>
        ) : shortfall ? (
          <>
            At this pace, you could be{" "}
            <span className="font-bold tabular-nums text-rose-200">
              {formatMoney(absAmt)}
            </span>{" "}
            short before{" "}
            <span className="text-slate-300">{paydayLabel}</span>.
          </>
        ) : (
          <>
            At this pace, you will have{" "}
            <span className="font-bold tabular-nums text-emerald-200">
              {formatMoney(projectedBalanceAtPayday)}
            </span>{" "}
            left by{" "}
            <span className="text-slate-300">{paydayLabel}</span>.
          </>
        )}
      </p>
      {daysUntilPayday > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Based on ~{formatMoney(dailySpendPace)}/day average spend this month ×{" "}
          {daysUntilPayday} day{daysUntilPayday === 1 ? "" : "s"} until payday — updates as you
          log expenses.
        </p>
      ) : null}
    </div>
  );
}
