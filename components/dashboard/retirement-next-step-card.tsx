"use client";

import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import type { RetirementNextStep, RetirementNextStepCta } from "@/lib/retirement-next-step";

type Props = {
  step: RetirementNextStep;
  onUpdatePlan: () => void;
  onAddAccounts: () => void;
};

function CtaButton(props: {
  cta: RetirementNextStepCta;
  label: string;
  onUpdatePlan: () => void;
  onAddAccounts: () => void;
}) {
  const className =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow-sm backdrop-blur-sm transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/22 motion-reduce:transition-none";

  if (props.cta === "review_goals") {
    return (
      <Link href="/goals" className={className}>
        {props.label}
        <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
      </Link>
    );
  }

  if (props.cta === "add_accounts") {
    return (
      <button type="button" onClick={props.onAddAccounts} className={className}>
        {props.label}
        <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
      </button>
    );
  }

  return (
    <button type="button" onClick={props.onUpdatePlan} className={className}>
      {props.label}
      <ArrowRight className="h-4 w-4 opacity-90" aria-hidden />
    </button>
  );
}

export default function RetirementNextStepCard({
  step,
  onUpdatePlan,
  onAddAccounts,
}: Props) {
  return (
    <section
      className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-slate-900/55 to-slate-950/65 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-6"
      aria-labelledby="retirement-next-step-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
            aria-hidden
          >
            <Compass className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-200/70">
              Next step
            </p>
            <h2
              id="retirement-next-step-heading"
              className="mt-1 text-lg font-semibold tracking-tight text-slate-50 sm:text-xl"
            >
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.explanation}</p>
          </div>
        </div>
        <div className="flex shrink-0 sm:pt-1">
          <CtaButton
            cta={step.cta}
            label={step.ctaLabel}
            onUpdatePlan={onUpdatePlan}
            onAddAccounts={onAddAccounts}
          />
        </div>
      </div>
    </section>
  );
}
