"use client";

import { Fragment } from "react";
import { formatMoney } from "@/lib/dashboard-data";
import type { MoneyFlowSnapshot } from "@/lib/overview-money-flow";
import { moneyFlowBarFractions } from "@/lib/overview-money-flow";

function Arrow() {
  return (
    <span
      className="hidden shrink-0 text-slate-600 sm:inline"
      aria-hidden
    >
      →
    </span>
  );
}

type Props = {
  flow: MoneyFlowSnapshot;
};

/**
 * Simple horizontal flow + stacked bar — where monthly money goes vs what’s left in the wallet.
 */
export default function OverviewMoneyFlow({ flow }: Props) {
  const { bills, savings, spending, incomeRemainder } = moneyFlowBarFractions(flow);
  const inc = Math.max(flow.incomeMonthly, 1);
  const sumParts = bills + savings + spending;
  const scale = sumParts > 1 ? 1 / sumParts : 1;
  const wBills = bills * scale * 100;
  const wSave = savings * scale * 100;
  const wSpend = spending * scale * 100;
  const wRest = Math.max(0, 100 - wBills - wSave - wSpend);

  const stages = [
    { key: "income", label: "Income", sub: "Monthly take-home", amount: flow.incomeMonthly, tone: "emerald" },
    { key: "bills", label: "Bills", sub: "Recurring (est. / mo)", amount: flow.billsMonthly, tone: "sky" },
    { key: "savings", label: "Savings", sub: "Goals (save + invest)", amount: flow.savingsAllocatedMonthly, tone: "violet" },
    { key: "spending", label: "Spending", sub: "Logged this month", amount: flow.spendingThisMonth, tone: "amber" },
    { key: "remaining", label: "Remaining", sub: "Balance after expenses", amount: flow.remainingBalance, tone: "slate" },
  ] as const;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-slate-950/45 p-4 shadow-[0_8px_32px_-18px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out hover:border-white/[0.12] hover:shadow-[0_14px_40px_-20px_rgba(0,0,0,0.65)] motion-reduce:transition-none sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Money flow
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-50 sm:text-lg">
            Where your money goes
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500 sm:text-sm">
            Income → bills → savings → this month&apos;s spending → what&apos;s left in your wallet.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-nowrap items-stretch gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:gap-2 sm:overflow-visible">
        {stages.map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 ? (
              <div className="flex w-6 shrink-0 items-center justify-center self-center sm:w-8">
                <Arrow />
              </div>
            ) : null}
            <div
              className={`min-w-[7.5rem] shrink-0 flex-1 rounded-2xl border px-3 py-2.5 sm:min-w-0 sm:px-2.5 sm:py-3 ${
                s.tone === "emerald"
                  ? "border-emerald-500/20 bg-emerald-950/30"
                  : s.tone === "sky"
                    ? "border-sky-500/20 bg-sky-950/25"
                    : s.tone === "violet"
                      ? "border-violet-500/20 bg-violet-950/25"
                      : s.tone === "amber"
                        ? "border-amber-500/20 bg-amber-950/25"
                        : "border-white/[0.08] bg-slate-900/40"
              }`}
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-wider text-slate-500">
                {s.label}
              </p>
              <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-white sm:text-lg">
                {formatMoney(s.amount)}
              </p>
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500/95 sm:text-[11px]">
                {s.sub}
              </p>
            </div>
          </Fragment>
        ))}
      </div>

      <div className="mt-6">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
          Share of monthly income
        </p>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-800/90">
          {wBills > 0.5 ? (
            <div
              className="h-full bg-sky-500/85 transition-[width] duration-500"
              style={{ width: `${wBills}%` }}
              title={`Bills ${Math.round((flow.billsMonthly / inc) * 100)}%`}
            />
          ) : null}
          {wSave > 0.5 ? (
            <div
              className="h-full bg-violet-500/80 transition-[width] duration-500"
              style={{ width: `${wSave}%` }}
              title={`Savings ${Math.round((flow.savingsAllocatedMonthly / inc) * 100)}%`}
            />
          ) : null}
          {wSpend > 0.5 ? (
            <div
              className="h-full bg-amber-500/85 transition-[width] duration-500"
              style={{ width: `${wSpend}%` }}
              title={`Spending ${Math.round((flow.spendingThisMonth / inc) * 100)}%`}
            />
          ) : null}
          {wRest > 0.5 ? (
            <div
              className="h-full bg-slate-600/70 transition-[width] duration-500"
              style={{ width: `${wRest}%` }}
              title="Unallocated vs income"
            />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500/85 align-middle" /> Bills
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-violet-500/80 align-middle" /> Savings
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500/85 align-middle" /> Spending
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-full bg-slate-600/70 align-middle" /> Room in
            income
          </span>
        </div>
        {incomeRemainder < 0 ? (
          <p className="mt-2 text-xs text-amber-200/90">
            Bills + savings + spending exceed this month&apos;s income on paper — lean on your balance
            and safe-to-spend until payday.
          </p>
        ) : null}
      </div>
    </div>
  );
}
