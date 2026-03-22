"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FinancialStatus } from "@/lib/financial-status";
import { formatMoney } from "@/lib/dashboard-data";
import type { FinancialHealthResult } from "@/lib/financial-health-score";
import type { OverviewNextAction } from "@/lib/overview-next-actions";
import type { OverviewPeriodSummary } from "@/lib/overview-period-summary";
import StatusBadge from "@/components/dashboard/status-badge";
import { CountUpMoney } from "@/components/motion/count-up-money";
import { MotionLink } from "@/components/motion/motion-link";
import { EASE_OUT, fadeOnly, fadeUpItem } from "@/components/motion/overview-variants";

/** Accent for “What to do next” — soft border only (lighter paints than large glows) */
export function getInsightAccent(status: FinancialStatus): {
  border: string;
  lineClass: string;
  bulletClass: string;
} {
  switch (status) {
    case "overspending":
      return {
        border: "border-rose-500/30",
        lineClass: "bg-rose-400/60",
        bulletClass: "bg-rose-400/70",
      };
    case "tight":
    case "behind":
    case "improving":
      return {
        border: "border-amber-400/25",
        lineClass: "bg-amber-400/50",
        bulletClass: "bg-amber-400/65",
      };
    default:
      return {
        border: "border-emerald-500/25",
        lineClass: "bg-emerald-400/50",
        bulletClass: "bg-emerald-400/65",
      };
  }
}

function reassuranceLine(financialStatus: FinancialStatus): string {
  switch (financialStatus) {
    case "overspending":
      return "You can adjust before payday — even small moves help.";
    case "tight":
    case "behind":
    case "improving":
      return "You decide where each dollar goes. Steady beats perfect.";
    default:
      return "This is your spending room, already accounting for what matters.";
  }
}

const heroEase =
  "transition-shadow duration-200 ease-out motion-reduce:transition-none";

export function OverviewFinancialHealthScore({ result }: { result: FinancialHealthResult }) {
  const bar =
    result.band === "strong"
      ? "bg-emerald-500"
      : result.band === "stable"
        ? "bg-sky-500"
        : "bg-rose-500/90";

  const shell =
    result.band === "strong"
      ? "border-emerald-500/20 bg-gradient-to-r from-emerald-950/30 to-slate-950/80"
      : result.band === "stable"
        ? "border-sky-500/20 bg-gradient-to-r from-sky-950/25 to-slate-950/80"
        : "border-rose-500/20 bg-gradient-to-r from-rose-950/30 to-slate-950/80";

  return (
    <div
      className={`rounded-3xl border p-4 shadow-[0_8px_32px_-18px_rgba(0,0,0,0.55)] transition-shadow duration-300 ease-out hover:shadow-[0_14px_40px_-20px_rgba(0,0,0,0.65)] motion-reduce:transition-none sm:p-5 ${shell}`}
      aria-label={`Financial health ${result.score} percent, ${result.statusLabel}`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Snapshot
        </p>
        <p className="text-xs text-slate-500/90 sm:text-right">
          Safe to spend, bills vs income, savings &amp; invest, retirement signal
        </p>
      </div>
      <p className="mt-3 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
        Financial Health:{" "}
        <span className="tabular-nums text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {result.score}%
        </span>
        <span className="ml-2 text-sm font-medium text-slate-500 sm:text-base">
          · {result.statusLabel}
        </span>
      </p>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${bar}`}
          style={{ width: `${result.score}%` }}
        />
      </div>
    </div>
  );
}

export function OverviewSafeToSpendHero({
  amountValue,
  untilLabel,
  status,
  badgeLabel,
}: {
  /** Raw number for count-up animation */
  amountValue: number;
  untilLabel: string;
  status: FinancialStatus;
  badgeLabel: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      id="safe-to-spend"
      layout
      whileHover={
        reduce
          ? undefined
          : {
              y: -2,
              boxShadow: "0 20px 48px -14px rgba(5,150,105,0.5)",
              transition: { duration: 0.2, ease: EASE_OUT },
            }
      }
      whileTap={reduce ? undefined : { scale: 0.995 }}
      className={`group relative cursor-default overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-6 text-white shadow-[0_12px_40px_-12px_rgba(5,150,105,0.4)] transition-transform duration-200 ease-out sm:p-7 lg:min-h-[11.5rem] ${heroEase}`}
    >
      <motion.div
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
        aria-hidden
        initial={reduce ? false : { opacity: 0.35, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.05 }}
        style={{ right: "-6rem", top: "-6rem" }}
      />
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-100/85">
            Safe to spend
          </p>
          <motion.div
            variants={fadeOnly(reduce, 0.18)}
            initial="hidden"
            animate="visible"
          >
            <StatusBadge
              status={status}
              label={badgeLabel}
              className="!border !border-white/15 !bg-white/10 !text-white"
            />
          </motion.div>
        </div>
        <p className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          <CountUpMoney value={amountValue} className="tabular-nums" />
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-emerald-50/70">
          After bills &amp; goals — through{" "}
          <span className="font-medium text-emerald-50">{untilLabel}</span>
        </p>
      </div>
    </motion.div>
  );
}

export function OverviewRetirementHero({
  formattedAmount,
  hasEstimate,
  caption,
}: {
  formattedAmount: string;
  hasEstimate: boolean;
  caption: string;
}) {
  const reduce = useReducedMotion();

  return (
    <MotionLink
      href="/retirement"
      whileHover={
        reduce
          ? undefined
          : {
              y: -2,
              boxShadow: "0 18px 44px -12px rgba(91,33,182,0.42)",
              borderColor: "rgba(167, 139, 250, 0.35)",
              transition: { duration: 0.2, ease: EASE_OUT },
            }
      }
      whileTap={reduce ? undefined : { scale: 0.995 }}
      className={`group relative flex min-h-0 flex-col justify-center overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700/90 via-indigo-800/95 to-slate-950 p-6 text-white shadow-[0_12px_36px_-10px_rgba(91,33,182,0.35)] sm:p-7 lg:min-h-[11.5rem] ${heroEase}`}
    >
      <motion.div
        className="pointer-events-none absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl"
        aria-hidden
        initial={reduce ? false : { opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.75, ease: EASE_OUT }}
      />
      <div className="relative min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-violet-200/70">
          Estimated retirement
        </p>
        <p className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight tabular-nums sm:text-5xl">
          {hasEstimate ? formattedAmount : "—"}
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-violet-100/70">{caption}</p>
        <p className="mt-3 text-xs font-medium text-violet-100/50">
          Details in Retirement{" "}
          <span
            aria-hidden
            className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
          >
            →
          </span>
        </p>
      </div>
    </MotionLink>
  );
}

export function OverviewGlassStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      variants={fadeUpItem(reduce)}
      whileHover={
        reduce
          ? undefined
          : {
              y: -3,
              boxShadow: "0 14px 36px -14px rgba(2,6,23,0.92)",
              borderColor: "rgba(56, 189, 248, 0.22)",
              transition: { duration: 0.18, ease: EASE_OUT },
            }
      }
      whileTap={reduce ? undefined : { scale: 0.994 }}
      className="rounded-2xl border border-white/[0.08] bg-slate-950/35 p-5 shadow-[0_8px_28px_-14px_rgba(2,6,23,0.85)] transition-colors duration-200 dark:bg-slate-900/35 sm:p-6"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-slate-50 sm:text-3xl sm:leading-none">
        {value}
      </p>
      {subtext != null && (
        <p className="mt-2.5 text-xs leading-relaxed text-slate-500/95">{subtext}</p>
      )}
    </motion.div>
  );
}

/** Unified income → bills → savings → balance + one-line verdict (command center). */
export function OverviewFinancialSummaryRow({ summary }: { summary: OverviewPeriodSummary }) {
  const shell =
    summary.sentenceVariant === "overspending"
      ? "border-rose-500/25 bg-gradient-to-br from-rose-950/40 via-slate-950/60 to-slate-950"
      : summary.sentenceVariant === "tight"
        ? "border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-950/60 to-slate-950"
        : "border-emerald-500/15 bg-gradient-to-br from-emerald-950/25 via-slate-950/60 to-slate-950";

  const sentenceClass =
    summary.sentenceVariant === "overspending"
      ? "text-rose-50"
      : summary.sentenceVariant === "tight"
        ? "text-amber-50"
        : "text-emerald-50";

  const statClass =
    "rounded-2xl border border-white/[0.07] bg-slate-950/45 px-4 py-3.5 transition duration-200 ease-out hover:border-white/[0.12] hover:bg-slate-900/40";

  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_8px_36px_-18px_rgba(0,0,0,0.65)] transition-shadow duration-300 ease-out hover:shadow-[0_14px_44px_-22px_rgba(0,0,0,0.72)] motion-reduce:transition-none sm:p-6 md:p-7 ${shell}`}
      aria-label="Financial summary this period"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            This pay period
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
            Financial snapshot
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500/95 sm:text-sm">
            How income, committed bills, and savings goals flow into what&apos;s left before
            payday.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className={statClass}>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Income this period
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
            {formatMoney(summary.incomeThisPeriod)}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500/95">Expected paycheck</p>
        </div>
        <div className={statClass}>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Bills committed
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
            {formatMoney(summary.billsCommitted)}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500/95">Due before payday</p>
        </div>
        <div className={statClass}>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Savings allocated
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
            {formatMoney(summary.savingsAllocated)}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500/95">
            Save + invest (from monthly take-home)
          </p>
        </div>
        <div className={statClass}>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">
            Remaining balance
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl sm:leading-none">
            {formatMoney(summary.remainingBalance)}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500/95">After logged expenses</p>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border px-4 py-3.5 sm:px-5 ${
          summary.sentenceVariant === "overspending"
            ? "border-rose-400/25 bg-rose-950/35"
            : summary.sentenceVariant === "tight"
              ? "border-amber-400/20 bg-amber-950/25"
              : "border-emerald-400/20 bg-emerald-950/20"
        }`}
      >
        <p className={`text-sm font-semibold leading-snug sm:text-base ${sentenceClass}`}>
          {summary.summarySentence}
        </p>
      </div>
    </div>
  );
}

export function OverviewWhatToDoNext({
  actions,
  financialStatus,
  accent,
  reassurance,
  children,
}: {
  actions: OverviewNextAction[];
  financialStatus: FinancialStatus;
  accent: ReturnType<typeof getInsightAccent>;
  reassurance?: string;
  children: React.ReactNode;
}) {
  const calm = reassurance ?? reassuranceLine(financialStatus);
  const reduce = useReducedMotion();
  const insightKey = actions.map((a) => a.id).join("|");

  return (
    <div
      className={`rounded-3xl border ${accent.border} bg-slate-950/40 p-6 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.55)] transition-shadow duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_14px_40px_-20px_rgba(0,0,0,0.65)] motion-reduce:transition-none sm:p-7`}
    >
      <div className="flex gap-4">
        <motion.div
          className={`mt-1.5 h-10 w-1 shrink-0 rounded-full ${accent.lineClass}`}
          aria-hidden
          initial={reduce ? false : { scaleY: 0.2, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          style={{ originY: 0 }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-slate-100 md:text-lg">
            What to do next
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-600">
            Rule-based · high impact
          </p>
          <motion.p
            className="mt-2 text-sm text-slate-500"
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT, delay: 0.04 }}
          >
            {calm}
          </motion.p>
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-white/[0.06] pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={insightKey}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="space-y-4"
          >
            {actions.map((action, i) => (
              <motion.div
                key={action.id}
                className="rounded-2xl border border-white/[0.08] bg-slate-900/45 p-4 transition-colors duration-200 hover:border-white/[0.12] sm:p-5"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.04 + i * 0.06 }}
              >
                <p className="text-sm font-semibold leading-snug text-slate-100 sm:text-[0.9375rem]">
                  {action.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{action.detail}</p>
                <MotionLink
                  href={action.primaryHref}
                  whileHover={
                    reduce
                      ? undefined
                      : { scale: 1.02, transition: { duration: 0.15, ease: EASE_OUT } }
                  }
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="mt-4 inline-flex min-h-[2.5rem] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-emerald-500 motion-reduce:transition-none"
                >
                  {action.primaryLabel}
                </MotionLink>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.div
        className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.06] pt-6"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.35 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
