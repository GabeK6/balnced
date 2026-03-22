"use client";

import { formatMoney } from "@/lib/dashboard-data";
import {
  DEBT_TYPE_LABELS,
  HIGH_INTEREST_APR_THRESHOLD,
  formatAprPercent,
  isHighInterestApr,
  type Debt,
  type DebtType,
} from "@/lib/debt";

function labelForType(t: string): string {
  return DEBT_TYPE_LABELS[t as DebtType] ?? t.replace(/_/g, " ");
}

/** Rough “days until next due” for a calendar day-of-month (1–31). */
function daysUntilNextDueDay(dueDay: number | null): number | null {
  if (dueDay == null) return null;
  const d = Math.floor(Number(dueDay));
  if (!Number.isFinite(d) || d < 1 || d > 31) return null;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = now.getDate();
  const lastThis = new Date(y, m + 1, 0).getDate();
  const safe = Math.min(d, lastThis);
  if (safe >= today) return safe - today;

  const nextY = m === 11 ? y + 1 : y;
  const nextM = m === 11 ? 0 : m + 1;
  const lastNext = new Date(nextY, nextM + 1, 0).getDate();
  const safeNext = Math.min(d, lastNext);
  const restOfMonth = lastThis - today;
  return restOfMonth + safeNext;
}

function dueStatusText(dueDay: number | null): string {
  const days = daysUntilNextDueDay(dueDay);
  if (days === null) return "No due day set";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Day ${dueDay} · next in ~${days} days`;
}

type Props = {
  debt: Debt;
  onEdit: () => void;
  onDelete: () => void;
  /** 1-based when list sort is snowball/avalanche */
  payoffPriority?: number | null;
  /** e.g. "Debt avalanche" */
  payoffStrategyLabel?: string | null;
};

export default function DebtItemCard({
  debt,
  onEdit,
  onDelete,
  payoffPriority = null,
  payoffStrategyLabel = null,
}: Props) {
  const balance = Number(debt.balance) || 0;
  const limit = debt.credit_limit != null ? Number(debt.credit_limit) : null;
  const utilization =
    limit != null && limit > 0 ? Math.min(100, (balance / limit) * 100) : null;
  const apr = Number(debt.apr) || 0;
  const minPay = Number(debt.minimum_payment) || 0;
  const high = isHighInterestApr(apr);
  const estMonthlyInterest = balance * (apr / 100) / 12;

  const typeLabel = labelForType(String(debt.debt_type));
  const dueLabel = debt.due_day != null ? String(debt.due_day) : "—";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900/35 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-white/[0.14] sm:p-5">
      {/* Top: full-width structured grid */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
        {/* Name + type — strongest column */}
        <div className="min-w-0 shrink-0 xl:w-[min(100%,14rem)]">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-50 sm:text-[1.05rem]">
              {debt.name}
            </h3>
            {high ? (
              <span className="shrink-0 rounded-md border border-rose-500/40 bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200/95">
                High APR (≥{HIGH_INTEREST_APR_THRESHOLD}%)
              </span>
            ) : null}
          </div>
          <span className="mt-2 inline-flex rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium capitalize text-slate-400">
            {typeLabel}
          </span>
        </div>

        {/* Stats — spread across width */}
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 lg:gap-x-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Balance
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-emerald-200/95 sm:text-xl">
              {formatMoney(balance)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">APR</p>
            <p
              className={`mt-1 text-base font-semibold tabular-nums sm:text-lg ${high ? "text-rose-200/95" : "text-slate-100"}`}
            >
              {formatAprPercent(apr, 2)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Minimum
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums text-slate-100 sm:text-lg">
              {formatMoney(minPay)}
            </p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Due day
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums text-slate-100 sm:text-lg">
              {dueLabel}
            </p>
          </div>
        </div>

        {/* Actions — right, compact */}
        <div className="flex shrink-0 flex-row gap-2 self-start xl:flex-col xl:items-stretch">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-emerald-500/30 hover:bg-white/[0.05]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-rose-500/25 px-3 py-2 text-xs font-medium text-rose-300/95 transition hover:bg-rose-500/10"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Secondary row */}
      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="flex flex-1 flex-wrap gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Est. monthly interest
              </p>
              <p className="mt-0.5 tabular-nums font-medium text-amber-200/90">{formatMoney(estMonthlyInterest)}</p>
            </div>
            {payoffPriority != null && payoffStrategyLabel ? (
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Payoff order
                </p>
                <p className="mt-0.5 font-medium text-violet-200/95">
                  #{payoffPriority} · {payoffStrategyLabel}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Due status
              </p>
              <p className="mt-0.5 text-slate-300">{dueStatusText(debt.due_day)}</p>
            </div>
            {utilization != null ? (
              <div className="min-w-[8rem] flex-1 lg:max-w-xs">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Credit utilization
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5"
                    role="progressbar"
                    aria-valuenow={Math.round(utilization)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] ${
                        utilization >= 90
                          ? "bg-gradient-to-r from-rose-500 to-amber-500"
                          : utilization >= 70
                            ? "bg-gradient-to-r from-amber-500 to-amber-400"
                            : "bg-gradient-to-r from-emerald-500 to-teal-400"
                      }`}
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </div>
                  <span className="shrink-0 tabular-nums text-xs font-medium text-slate-300">
                    {utilization.toFixed(0)}%
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {(debt.lender || debt.notes) && (
          <div className="mt-3 space-y-1 border-t border-white/[0.04] pt-3 text-xs leading-relaxed text-slate-500">
            {debt.lender ? (
              <p>
                <span className="text-slate-600">Lender:</span> {debt.lender}
              </p>
            ) : null}
            {debt.notes ? <p className="line-clamp-2">{debt.notes}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
