"use client";

import { formatMoney } from "@/lib/dashboard-data";
import type { PostExpenseFeedback } from "@/lib/expense-dashboard-summaries";

type Props = {
  feedback: PostExpenseFeedback | null;
  /** Bump on each successful add to replay enter animation. */
  animationKey: number;
};

export default function ExpensePostFeedback({ feedback, animationKey }: Props) {
  if (!feedback) return null;

  if (!feedback.hasMetrics) {
    return (
      <p
        key={animationKey}
        className="balnced-delta-reveal text-xs leading-relaxed text-slate-400"
      >
        Expense saved. Add your budget on Overview to see monthly impact.
      </p>
    );
  }

  const pct = feedback.pctUsed;
  const pctLabel = pct === null ? null : `${pct}%`;

  const surface =
    feedback.warning === "over"
      ? "border-rose-500/25 bg-rose-950/25"
      : feedback.warning === "close"
        ? "border-amber-500/20 bg-amber-950/20"
        : "border-emerald-500/15 bg-emerald-950/20";

  return (
    <div
      key={animationKey}
      className={`balnced-delta-reveal space-y-2 rounded-xl border px-3.5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${surface}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm leading-snug text-slate-200">
        {feedback.leftThisMonth >= 0 ? (
          <>
            You now have{" "}
            <strong className="font-semibold tabular-nums text-white">
              {formatMoney(feedback.leftThisMonth)}
            </strong>{" "}
            left to spend this month.
          </>
        ) : (
          <>
            You&apos;re{" "}
            <strong className="font-semibold tabular-nums text-rose-200">
              {formatMoney(Math.abs(feedback.leftThisMonth))}
            </strong>{" "}
            over this month&apos;s simple plan.
          </>
        )}
      </p>

      {pctLabel !== null && feedback.monthlyDisposable > 0 ? (
        <p className="text-xs leading-relaxed text-slate-500">
          You used{" "}
          <span className="font-semibold tabular-nums text-slate-200">
            {pctLabel}
          </span>{" "}
          of your monthly budget (income after bills &amp; savings).
        </p>
      ) : null}

      {feedback.warning === "close" ? (
        <p className="text-xs font-medium text-amber-200/95">
          You&apos;re close to overspending.
        </p>
      ) : null}

      {feedback.warning === "over" ? (
        <p className="text-xs font-medium text-rose-200/95">
          You&apos;re at or past a safe limit for this month or until payday.
        </p>
      ) : null}
    </div>
  );
}
