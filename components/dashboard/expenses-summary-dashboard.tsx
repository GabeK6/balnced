"use client";

import { formatMoney } from "@/lib/dashboard-data";
import WeeklySpendingTrend from "@/components/dashboard/weekly-spending-trend";
import type {
  ExpensesSafeGuidance,
  WeekOverWeekTrend,
} from "@/lib/expense-dashboard-summaries";

type Props = {
  loading: boolean;
  guidance: ExpensesSafeGuidance;
  thisMonthTotal: number;
  dailyAverage: number;
  safeToSpend: { value: number; canCompute: boolean };
  topCategory: { name: string; amount: number } | null;
  weekTrend: WeekOverWeekTrend;
};

function SafeToSpendBanner({ guidance }: { guidance: ExpensesSafeGuidance }) {
  const bandRing =
    guidance.band === "safe"
      ? "border-emerald-500/35 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
      : guidance.band === "moderate"
        ? "border-amber-500/35 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.12)]"
        : "border-rose-500/35 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]";

  const dot =
    guidance.band === "safe"
      ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.45)]"
      : guidance.band === "moderate"
        ? "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.4)]"
        : "bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.45)]";

  const headline =
    !guidance.canCompute ? (
      <p className="text-base font-medium leading-snug text-slate-200 sm:text-lg">
        Add a budget on Overview to unlock safe-to-spend guidance.
      </p>
    ) : guidance.monthlyTakeHome <= 0 ? (
      <p className="text-base font-medium leading-snug text-slate-200 sm:text-lg">
        Set your monthly take-home on Overview to see how much room is left
        this month after bills, savings, and spending.
      </p>
    ) : guidance.monthlyHeadroom >= 0 ? (
      <p className="text-base font-medium leading-snug text-slate-200 sm:text-lg">
        You can safely spend{" "}
        <strong className="font-semibold tabular-nums text-white">
          {formatMoney(guidance.monthlyHeadroom)}
        </strong>{" "}
        more this month.
      </p>
    ) : (
      <p className="text-base font-medium leading-snug text-slate-200 sm:text-lg">
        This month you&apos;re{" "}
        <strong className="font-semibold tabular-nums text-rose-200">
          {formatMoney(Math.abs(guidance.monthlyHeadroom))}
        </strong>{" "}
        over a simple monthly plan (income − recurring bills − savings −
        spending).
      </p>
    );

  return (
    <div
      className={`flex gap-4 rounded-2xl border bg-slate-950/50 p-4 shadow-sm shadow-black/20 backdrop-blur-sm transition duration-300 ease-out hover:shadow-md hover:shadow-black/25 sm:p-5 ${bandRing}`}
      role="status"
      aria-live="polite"
      aria-label={`Safe to spend: ${guidance.band}`}
    >
      <div className="flex shrink-0 flex-col items-center pt-1">
        <span
          className={`h-3 w-3 rounded-full ${dot}`}
          title={
            guidance.band === "safe"
              ? "On track"
              : guidance.band === "moderate"
                ? "Moderate"
                : "Tight or over plan"
          }
        />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Safe to spend
        </p>
        {headline}
        {safeToSpendHint(guidance)}
      </div>
    </div>
  );
}

function safeToSpendHint(g: ExpensesSafeGuidance) {
  if (!g.canCompute) return null;
  return (
    <p className="text-sm leading-relaxed text-slate-500">
      Until payday:{" "}
      <span className="font-medium tabular-nums text-slate-300">
        {formatMoney(g.runwaySafe)}
      </span>{" "}
      after bills &amp; goals from your balance —{" "}
      <span className="text-slate-400">{g.runwayStatusLabel}</span>
      {g.daysUntilPayday > 0 ? (
        <>
          {" "}
          ·{" "}
          <span className="tabular-nums">
            ~{formatMoney(g.dailyLimit)}/day
          </span>{" "}
          if spread evenly
        </>
      ) : null}
    </p>
  );
}

function StatCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: "emerald" | "sky" | "amber" | "slate";
}) {
  const ring =
    emphasize === "emerald"
      ? "ring-1 ring-emerald-500/20"
      : emphasize === "sky"
        ? "ring-1 ring-sky-500/20"
        : emphasize === "amber"
          ? "ring-1 ring-amber-500/20"
          : "";

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-slate-900/40 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_36px_-20px_rgba(0,0,0,0.55)] sm:p-5 ${ring}`}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-[1.65rem] font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function ExpensesSummaryDashboard({
  loading,
  guidance,
  thisMonthTotal,
  dailyAverage,
  safeToSpend,
  topCategory,
  weekTrend,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-4 w-36 animate-pulse rounded bg-slate-800" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-800/70" />
        <div className="h-36 animate-pulse rounded-2xl bg-slate-800/70" />
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-800/60"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5" aria-label="Spending overview">
      <header className="border-b border-white/[0.06] pb-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Summary
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
          Overview
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          This month, your pace, and week-over-week spending.
        </p>
      </header>

      <SafeToSpendBanner guidance={guidance} />

      <WeeklySpendingTrend trend={weekTrend} />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Spent this month"
          value={formatMoney(thisMonthTotal)}
          hint="All logged expenses with dates this calendar month."
          emphasize="sky"
        />
        <StatCard
          label="Daily average (month)"
          value={formatMoney(dailyAverage)}
          hint="Month-to-date total ÷ day of month."
          emphasize="slate"
        />
        <StatCard
          label="Runway until payday"
          value={
            safeToSpend.canCompute ? formatMoney(safeToSpend.value) : "—"
          }
          hint={
            safeToSpend.canCompute
              ? "Balance after logged expenses, minus bills due before payday and goal slices (same as Overview)."
              : "Add a budget on Overview to calculate this."
          }
          emphasize="emerald"
        />
        <StatCard
          label="Largest category (month)"
          value={topCategory ? formatMoney(topCategory.amount) : "—"}
          hint={topCategory ? topCategory.name : "No spending this month yet."}
          emphasize="amber"
        />
      </div>
    </section>
  );
}
