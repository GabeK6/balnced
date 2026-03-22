"use client";

import { formatMoney } from "@/lib/dashboard-data";

/** billsPressure = monthly bills ÷ take-home; low below 40%, moderate 40–70%, high above 70%. */
type PressureLevel = "low" | "moderate" | "high";

function billsPressureLevel(pct: number): PressureLevel {
  if (pct < 40) return "low";
  if (pct <= 70) return "moderate";
  return "high";
}

type Props = {
  loading: boolean;
  /** Hide the “At a glance / Bills dashboard” title block when a page-level hero already shows the title. */
  suppressIntro?: boolean;
  /** Estimated monthly take-home from budget (paycheck × frequency). */
  monthlyTakeHome: number;
  monthlyRecurringTotal: number;
  overdueTotal: number;
  overdueCount: number;
  upcomingThisMonthTotal: number;
  upcomingCount: number;
  paidThisMonthTotal: number;
  paidThisMonthCount: number;
  overdueInsight: string | null;
  nextDueInsight: string | null;
};

function StatCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: "default" | "amber" | "rose" | "emerald";
}) {
  const ring =
    emphasize === "rose"
      ? "ring-1 ring-rose-500/25"
      : emphasize === "amber"
        ? "ring-1 ring-amber-500/20"
        : emphasize === "emerald"
          ? "ring-1 ring-emerald-500/20"
          : "";

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-slate-900/35 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-300 ease-out hover:border-white/[0.14] sm:hover:-translate-y-0.5 sm:hover:shadow-lg sm:hover:shadow-black/25 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${ring}`}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function BillsSummarySection({
  loading,
  suppressIntro = false,
  monthlyTakeHome,
  monthlyRecurringTotal,
  overdueTotal,
  overdueCount,
  upcomingThisMonthTotal,
  upcomingCount,
  paidThisMonthTotal,
  paidThisMonthCount,
  overdueInsight,
  nextDueInsight,
}: Props) {
  const billsMonthly = monthlyRecurringTotal;
  const hasIncome = monthlyTakeHome > 0;
  const billsPressure = hasIncome ? billsMonthly / monthlyTakeHome : null;
  const pctOfIncome = billsPressure != null ? billsPressure * 100 : null;
  const pctForMessage =
    pctOfIncome != null ? Math.round(pctOfIncome) : null;
  const pressure =
    pctOfIncome != null ? billsPressureLevel(pctOfIncome) : null;
  const barFillPct =
    pctOfIncome != null ? Math.min(100, Math.max(0, pctOfIncome)) : 0;

  const pressureStyles: Record<
    PressureLevel,
    { label: string; badge: string; bar: string; hint: string }
  > = {
    low: {
      label: "Low pressure",
      badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
      bar: "bg-gradient-to-r from-emerald-600 to-teal-500",
      hint: "Under 40% of income",
    },
    moderate: {
      label: "Moderate",
      badge: "border-amber-500/40 bg-amber-500/15 text-amber-100",
      bar: "bg-gradient-to-r from-amber-500 to-amber-400",
      hint: "40–70% of income",
    },
    high: {
      label: "High",
      badge: "border-rose-500/40 bg-rose-500/15 text-rose-100",
      bar: "bg-gradient-to-r from-rose-600 to-rose-500",
      hint: "Over 70% of income",
    },
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-slate-900/35 p-6">
        <p className="text-sm text-slate-400">Loading bill summary…</p>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-label="Bills overview">
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/55 via-slate-900/35 to-slate-950/50 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all duration-300 ease-out hover:border-white/[0.14] motion-reduce:transition-none sm:p-6">
        {!suppressIntro ? (
          <>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-200/75">
              At a glance
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
              Bills dashboard
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              Totals use your recurring templates and this month&apos;s ledger—same data as the lists
              below.
            </p>
          </>
        ) : null}

        <div
          className={`rounded-xl border border-white/[0.08] bg-slate-950/40 p-4 sm:p-5 ${suppressIntro ? "" : "mt-5"}`}
        >
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            Bill pressure
          </p>
          {hasIncome && pctForMessage != null ? (
            <p className="mt-2 text-base font-medium leading-snug text-slate-100 sm:text-lg">
              Your bills take up{" "}
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {pctForMessage}%
              </span>{" "}
              of your income.
            </p>
          ) : (
            <p className="mt-2 text-base font-medium text-slate-100 sm:text-lg">
              Estimated bills:{" "}
              <span className="text-2xl font-bold tabular-nums text-white sm:text-3xl">
                {formatMoney(billsMonthly)}
              </span>
              <span className="text-slate-500"> / month</span>
            </p>
          )}

          {hasIncome ? (
            <p className="mt-1.5 text-xs text-slate-500">
              Bills {formatMoney(billsMonthly)} · Income {formatMoney(monthlyTakeHome)} (from your
              budget)
            </p>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Add paycheck info on Overview to see how bills compare to your income.
            </p>
          )}

          {hasIncome ? (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {pressure ? (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${pressureStyles[pressure].badge}`}
                  >
                    {pressureStyles[pressure].label}
                    <span className="ml-1 font-normal opacity-90">
                      ({pressureStyles[pressure].hint})
                    </span>
                  </span>
                ) : null}
                {pctOfIncome != null && pctOfIncome > 100 ? (
                  <span className="text-xs font-medium text-rose-300/90">
                    Your bills here are higher than your income—check amounts or income.
                  </span>
                ) : null}
              </div>
              <div className="mt-3">
                <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
                  <span>0%</span>
                  <span className="tabular-nums">100%</span>
                </div>
                <div className="relative">
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/5"
                    role="progressbar"
                    aria-valuenow={Math.round(barFillPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Your bills take up about ${pctForMessage} percent of your income`}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                        pressure ? pressureStyles[pressure].bar : "bg-slate-500"
                      }`}
                      style={{ width: `${barFillPct}%` }}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
                    <div className="absolute left-[40%] top-0 h-full w-px -translate-x-1/2 bg-white/25" />
                    <div className="absolute left-[70%] top-0 h-full w-px -translate-x-1/2 bg-white/25" />
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-600">
                  Guides at 40% and 70% (low / moderate / high)
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Est. monthly bills"
            value={formatMoney(monthlyRecurringTotal)}
            hint={
              upcomingCount + overdueCount > 0
                ? `${upcomingCount + overdueCount} unpaid this cycle in view`
                : "From active recurring templates"
            }
          />
          <StatCard
            label="Overdue (unpaid)"
            value={formatMoney(overdueTotal)}
            hint={
              overdueCount > 0
                ? `${overdueCount} bill${overdueCount !== 1 ? "s" : ""} past due`
                : "Nothing overdue right now"
            }
            emphasize={overdueCount > 0 ? "rose" : undefined}
          />
          <StatCard
            label="Due rest of month"
            value={formatMoney(upcomingThisMonthTotal)}
            hint={
              upcomingCount > 0
                ? `${upcomingCount} still to pay (today–month end)`
                : "No remaining due dates this month"
            }
            emphasize={upcomingCount > 0 ? "amber" : undefined}
          />
          <StatCard
            label="Paid this month"
            value={formatMoney(paidThisMonthTotal)}
            hint={
              paidThisMonthCount > 0
                ? `${paidThisMonthCount} marked paid (due this month)`
                : "Paid recurring due in this calendar month"
            }
            emphasize={paidThisMonthCount > 0 ? "emerald" : undefined}
          />
        </div>

        {(overdueInsight || nextDueInsight) && (
          <div className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/40 px-4 py-3.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
              Quick insights
            </p>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-300">
              {overdueInsight ? (
                <li className="flex gap-2">
                  <span className="text-rose-300/90" aria-hidden>
                    !
                  </span>
                  <span>{overdueInsight}</span>
                </li>
              ) : null}
              {nextDueInsight ? (
                <li className="flex gap-2">
                  <span className="text-emerald-300/90" aria-hidden>
                    →
                  </span>
                  <span>{nextDueInsight}</span>
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
