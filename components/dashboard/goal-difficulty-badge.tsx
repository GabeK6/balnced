"use client";

import type { GoalDifficultyLevel } from "@/lib/goal-difficulty";
import { goalDifficultyLabel } from "@/lib/goal-difficulty";

const STYLES: Record<
  GoalDifficultyLevel,
  string
> = {
  easy: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
  moderate: "bg-amber-500/15 text-amber-100 ring-amber-500/20",
  aggressive: "bg-rose-500/15 text-rose-100 ring-rose-500/25",
};

type Props = {
  level: GoalDifficultyLevel | null;
  className?: string;
};

export default function GoalDifficultyBadge({ level, className = "" }: Props) {
  if (!level) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STYLES[level]} ${className}`}
      title="Based on funding time and goal size vs your take-home pay"
    >
      {goalDifficultyLabel(level)}
    </span>
  );
}
