"use client";

import type { RecurringBill } from "@/lib/dashboard-data";
import { formatMoney } from "@/lib/dashboard-data";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

export type RecurringTemplateInsight = {
  schedule: string;
  nextDue: string | null;
  streakLine: string | null;
};

type Props = {
  templates: RecurringBill[];
  insightById: Map<string, RecurringTemplateInsight>;
  loading?: boolean;
  onDeleteTemplate: (id: string) => void;
};

function frequencyLabel(f: RecurringBill["frequency"]): string {
  switch (f) {
    case "monthly":
      return "Monthly";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    default:
      return f;
  }
}

export default function RecurringTemplatesList({
  templates,
  insightById,
  loading,
  onDeleteTemplate,
}: Props) {
  if (loading) {
    return (
      <div className="balnced-panel rounded-2xl p-5 text-sm text-slate-400 transition-colors duration-200">
        Loading recurring templates…
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <SectionEmptyState
        title="No recurring templates yet"
        description="Add one below—Balnced predicts next due dates and tracks streaks."
        example="e.g. Rent — monthly on the 1st"
        actionLabel="Add bill template"
        actionHref="#add-bill-template"
        align="center"
        className="rounded-2xl bg-slate-950/25 p-6 sm:p-8"
      />
    );
  }

  const sorted = [...templates].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return (
    <ul className="space-y-3" aria-label="Recurring bill templates">
      {sorted.map((t) => {
        const ins = insightById.get(t.id);
        const cat = t.category?.trim() || "Uncategorized";
        return (
          <li
            key={t.id}
            className="rounded-xl border border-white/[0.08] bg-slate-950/45 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all duration-200 ease-out hover:border-white/[0.14] hover:bg-slate-950/65 sm:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold tracking-tight text-slate-50">{t.name}</h3>
                  <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {cat}
                  </span>
                  <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {frequencyLabel(t.frequency)}
                  </span>
                </div>

                <p className="text-sm leading-snug text-slate-400">{ins?.schedule ?? "—"}</p>

                <div className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-2.5 text-sm">
                  {ins?.nextDue ? (
                    <p>
                      <span className="text-slate-500">Next due </span>
                      <span className="font-semibold tabular-nums text-sky-200/95">{ins.nextDue}</span>
                    </p>
                  ) : (
                    <p className="text-slate-500">Next due — set schedule fields to predict.</p>
                  )}
                  {ins?.streakLine ? (
                    <p className="text-xs leading-relaxed text-emerald-200/85">{ins.streakLine}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-white/[0.06] pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-white">
                  {formatMoney(Number(t.amount))}
                </p>
                <button
                  type="button"
                  onClick={() => onDeleteTemplate(t.id)}
                  className="rounded-lg bg-rose-950/50 px-3 py-1.5 text-xs font-medium text-rose-300 ring-1 ring-rose-500/30 transition hover:bg-rose-900/50"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
