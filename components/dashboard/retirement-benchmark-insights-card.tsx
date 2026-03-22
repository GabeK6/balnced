"use client";

import { Scale } from "lucide-react";
import type { BenchmarkInsightLine } from "@/lib/retirement-benchmark-insights";

function variantClass(v: BenchmarkInsightLine["variant"]): string {
  switch (v) {
    case "positive":
      return "text-emerald-200/95";
    case "nudge":
      return "text-amber-100/90";
    default:
      return "text-slate-200";
  }
}

type Props = {
  lines: BenchmarkInsightLine[];
  headline: string;
  currentAge: number;
};

export default function RetirementBenchmarkInsightsCard({
  lines,
  headline,
  currentAge,
}: Props) {
  if (!lines.length) return null;

  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6"
      aria-labelledby="retirement-benchmark-insights-heading"
    >
      <div className="flex gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-300"
          aria-hidden
        >
          <Scale className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            How you compare
          </p>
          <h2
            id="retirement-benchmark-insights-heading"
            className="mt-1 text-base font-semibold tracking-tight text-slate-50"
          >
            Rule-of-thumb context for age {Math.round(currentAge)}
          </h2>
          <p className="mt-2 text-sm font-medium leading-snug text-slate-200">{headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Simple planning ranges—not averages from a survey. Use them as a loose yardstick, not a grade.
          </p>
          <ul className="mt-4 list-none space-y-3 p-0">
            {lines.map((line, i) => (
              <li
                key={i}
                className={`relative pl-4 text-sm leading-snug before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-500/80 ${variantClass(line.variant)}`}
              >
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
