"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FinancialStatus } from "@/lib/financial-status";
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
      className={`group relative cursor-default overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 p-6 text-white shadow-[0_12px_40px_-12px_rgba(5,150,105,0.4)] sm:p-7 lg:min-h-[11.5rem] ${heroEase}`}
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
        <p className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          <CountUpMoney value={amountValue} className="tabular-nums" />
        </p>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-emerald-50/80">
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
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700/90 via-indigo-800/95 to-slate-950 p-6 text-white shadow-[0_12px_36px_-10px_rgba(91,33,182,0.35)] sm:p-7 lg:min-h-[11.5rem]"
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
        <p className="mt-3 text-xl font-bold leading-tight tracking-tight sm:text-2xl">
          {hasEstimate ? formattedAmount : "—"}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-violet-100/65">{caption}</p>
      </div>
      <span className="relative mt-4 text-xs font-medium text-white/55">
        Details in Retirement{" "}
        <span aria-hidden className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none">
          →
        </span>
      </span>
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
      className="rounded-2xl border border-white/[0.08] bg-slate-950/35 p-5 shadow-[0_8px_28px_-14px_rgba(2,6,23,0.85)] dark:bg-slate-900/35 sm:p-6"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-bold tabular-nums tracking-tight text-slate-50 sm:text-xl">{value}</p>
      {subtext != null && (
        <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{subtext}</p>
      )}
    </motion.div>
  );
}

type Guidance = {
  status: string;
  actions: string[];
  nextEvent: string;
  optionalOptimization: string | null;
} | null;

export function OverviewWhatToDoNext({
  guidance,
  financialStatus,
  accent,
  reassurance,
  children,
}: {
  guidance: Guidance;
  financialStatus: FinancialStatus;
  accent: ReturnType<typeof getInsightAccent>;
  reassurance?: string;
  children: React.ReactNode;
}) {
  const calm = reassurance ?? reassuranceLine(financialStatus);
  const reduce = useReducedMotion();
  const insightKey = guidance
    ? `${guidance.status}|${guidance.actions.join("|")}|${guidance.nextEvent}`
    : "loading";

  return (
    <div
      className={`rounded-3xl border ${accent.border} bg-slate-950/40 p-6 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.55)] sm:p-7`}
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
          <motion.p
            className="mt-1 text-sm text-slate-500"
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
          {guidance ? (
            <motion.div
              key={insightKey}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="space-y-4"
            >
              <p className="text-sm font-medium leading-relaxed text-slate-200 sm:text-[0.9375rem]">
                {guidance.status}
              </p>
              {guidance.actions.length > 0 && (
                <ul className="space-y-2.5">
                  {guidance.actions.slice(0, 2).map((action, i) => (
                    <motion.li
                      key={`${insightKey}-a-${i}`}
                      className="flex gap-2.5 text-sm leading-relaxed text-slate-400"
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.05 + i * 0.05 }}
                    >
                      <span className={`mt-2 h-1 w-1 shrink-0 rounded-full ${accent.bulletClass}`} />
                      {action}
                    </motion.li>
                  ))}
                </ul>
              )}
              {guidance.nextEvent ? (
                <p className="text-sm text-slate-400">
                  <span className="text-slate-600">Up next · </span>
                  {guidance.nextEvent}
                </p>
              ) : null}
              {guidance.optionalOptimization ? (
                <p className="text-xs leading-relaxed text-sky-400/80">{guidance.optionalOptimization}</p>
              ) : null}
            </motion.div>
          ) : (
            <motion.p
              key="fetching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-500"
            >
              Fetching suggestions…
            </motion.p>
          )}
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
