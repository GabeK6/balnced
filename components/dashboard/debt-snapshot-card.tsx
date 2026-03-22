"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/dashboard-data";
import {
  computeDebtSnapshot,
  formatAprPercent,
  type Debt,
} from "@/lib/debt";

const cardClass =
  "rounded-3xl border border-white/[0.07] bg-slate-950/40 p-5 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.55)] transition-[box-shadow,border-color] duration-300 ease-out sm:p-6";

type Props = {
  debts: Debt[];
};

export default function DebtSnapshotCard({ debts }: Props) {
  const snap = computeDebtSnapshot(debts);
  const hasRows = debts.length > 0;

  return (
    <div className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Debt snapshot
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-100">
            {hasRows ? "Your debt at a glance" : "Track what you owe"}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
            {hasRows
              ? "Estimated monthly interest uses each balance × APR ÷ 12 — a simple read on carrying costs."
              : "Add credit cards and loans to see totals, weighted APR, and interest estimates here."}
          </p>
        </div>
        <Link
          href="/debts"
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-emerald-300/95 transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
        >
          {hasRows ? "Manage debts" : "Add debts"}
        </Link>
      </div>

      {!hasRows ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/12 bg-slate-900/25 px-4 py-8 text-center">
          <p className="text-sm text-slate-400">
            No debts recorded yet — your overview stays uncluttered until you add them.
          </p>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Debt totals">
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/35 px-4 py-3.5">
              <dt className="text-xs font-medium text-slate-500">Total debt</dt>
              <dd className="mt-1 tabular-nums text-lg font-semibold text-slate-50">
                {formatMoney(snap.totalDebt)}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/35 px-4 py-3.5">
              <dt className="text-xs font-medium text-slate-500">Weighted avg APR</dt>
              <dd className="mt-1 tabular-nums text-lg font-semibold text-slate-50">
                {formatAprPercent(snap.weightedAverageApr, 2)}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/35 px-4 py-3.5">
              <dt className="text-xs font-medium text-slate-500">Total minimum payments</dt>
              <dd className="mt-1 tabular-nums text-lg font-semibold text-slate-50">
                {formatMoney(snap.totalMinimumPayments)}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/35 px-4 py-3.5">
              <dt className="text-xs font-medium text-slate-500">Est. monthly interest</dt>
              <dd className="mt-1 tabular-nums text-lg font-semibold text-amber-200/95">
                {formatMoney(snap.estimatedMonthlyInterest)}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-slate-900/35 px-4 py-3.5 sm:col-span-2 lg:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Highest APR</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-100">
                {snap.highestAprDebtName && snap.highestApr !== null ? (
                  <>
                    <span className="text-slate-200">{snap.highestAprDebtName}</span>
                    <span className="ml-2 tabular-nums text-emerald-300/90">
                      {formatAprPercent(snap.highestApr, 2)}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-600">
            Estimated monthly interest cost:{" "}
            <span className="font-medium text-slate-500">{formatMoney(snap.estimatedMonthlyInterest)}</span>
          </p>
        </>
      )}
    </div>
  );
}
