"use client";

import type { FinancialStatus } from "@/lib/financial-status";

export type StatusBadgeVariant = FinancialStatus | "on_track" | "very_strong";

const STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  on_track: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    label: "On track",
  },
  tight: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    label: "Tight",
  },
  overspending: {
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-200",
    label: "Overspending",
  },
  strong: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-200",
    label: "Strong",
  },
  behind: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    label: "Behind",
  },
  improving: {
    bg: "bg-sky-100 dark:bg-sky-900/40",
    text: "text-sky-800 dark:text-sky-200",
    label: "Improving",
  },
  "Very Strong": {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-800 dark:text-violet-200",
    label: "Very Strong",
  },
  "On Track": {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    label: "On Track",
  },
  Behind: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    label: "Behind",
  },
  Strong: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-200",
    label: "Strong",
  },
};

type StatusBadgeProps = {
  /** FinancialStatus from getSafeToSpendStatus/getGoalStatus, or retirement status string */
  status: FinancialStatus | string;
  /** Override display label */
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className = "" }: StatusBadgeProps) {
  const style = STYLES[status] ?? STYLES.on_track;
  const displayLabel = label ?? style.label ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold leading-tight ${style.bg} ${style.text} ${className}`}
    >
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
