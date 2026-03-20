"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { RecommendationPlan } from "@/lib/recommendation";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export type SuggestedMonthlyAmountsVariant = "investments" | "retirement";

export function SuggestedMonthlyAmountsCard({
  plan,
  variant,
}: {
  plan: RecommendationPlan | null;
  variant: SuggestedMonthlyAmountsVariant;
}) {
  const allocation = useMemo(() => {
    if (!plan) return {};
    return {
      bills: `Keep under ${formatMoney(plan.monthlyBills)}/mo`,
      savings: `${formatMoney(plan.suggestedSaveMonthly)}/mo for goals & emergency`,
      investing: `${formatMoney(plan.suggestedInvestMonthly)}/mo for retirement`,
      discretionary: `About ${formatMoney(plan.discretionaryMonthly)}/mo for spending`,
    };
  }, [plan]);

  const monthlyPay = plan?.monthlyIncome ?? 0;
  const suggestedInvest = plan?.suggestedInvestMonthly ?? 0;
  const suggestedSave = plan?.suggestedSaveMonthly ?? 0;
  const paychecksPerMonth = plan?.paychecksPerMonth ?? 1;
  const investPct =
    plan && monthlyPay > 0 ? ((suggestedInvest / monthlyPay) * 100).toFixed(1) : null;
  const savePct =
    plan && monthlyPay > 0 ? ((suggestedSave / monthlyPay) * 100).toFixed(1) : null;
  const investPerPaycheck =
    paychecksPerMonth > 0 ? suggestedInvest / paychecksPerMonth : 0;
  const savePerPaycheck =
    paychecksPerMonth > 0 ? suggestedSave / paychecksPerMonth : 0;

  return (
    <div className="balnced-panel rounded-3xl p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-100">
        Suggested monthly amounts
      </h2>
      {variant === "investments" ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          From your income (Income &amp; balance), save/invest % on Goals and below, your Roth/401(k)
          fields on this page, and bills. Updates as you type before you save.
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          From your income (Income &amp; balance), save % on{" "}
          <Link
            href="/goals"
            className="font-medium text-emerald-600 underline dark:text-emerald-400"
          >
            Goals
          </Link>
          , optional Invest % (below),{" "}
          <strong>Roth/401(k) amounts</strong> in your plan on this page, and bills.
        </p>
      )}
      {monthlyPay <= 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Monthly income is $0 — add paycheck info in{" "}
          <Link
            href="/onboarding"
            className="font-medium text-amber-800 underline dark:text-amber-100"
          >
            Income &amp; balance
          </Link>{" "}
          to see dollar amounts.
        </p>
      )}
      {monthlyPay > 0 && suggestedInvest === 0 && suggestedSave === 0 && (
        <p className="balnced-row mt-2 rounded-xl px-3 py-2 text-xs text-slate-400">
          {variant === "investments" ? (
            <>
              Set <strong>Invest %</strong> here and <strong>Save %</strong> on Goals — amounts stay
              $0 until those targets are set.
            </>
          ) : (
            <>
              Add <strong>Roth / 401(k)</strong> contributions in your plan above, optional{" "}
              <strong>Invest %</strong>{" "}
              <Link
                href="/retirement#retirement-contributions"
                className="font-semibold text-emerald-600 underline dark:text-emerald-400"
              >
                below
              </Link>
              , and <strong>Save %</strong> on{" "}
              <Link
                href="/goals"
                className="font-semibold text-emerald-600 underline dark:text-emerald-400"
              >
                Goals
              </Link>{" "}
              — retirement and save lines stay $0 until then.
            </>
          )}
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="balnced-row rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Retirement (Roth, 401(k), etc.)
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-100 sm:text-2xl">
            {formatMoney(suggestedInvest)}/mo
          </p>
          {investPct != null && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {investPct}% of monthly pay ({formatMoney(investPerPaycheck)}/paycheck)
            </p>
          )}
        </div>
        <div className="balnced-row rounded-xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Save (emergency / goals)
          </p>
          <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-100 sm:text-2xl">
            {formatMoney(suggestedSave)}/mo
          </p>
          {savePct != null && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {savePct}% of monthly pay ({formatMoney(savePerPaycheck)}/paycheck)
            </p>
          )}
        </div>
      </div>
      {Object.keys(allocation).length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Allocation guide</p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {Object.entries(allocation).map(([key, value]) => (
              <li key={key}>
                <span className="capitalize">{key}:</span> {value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
