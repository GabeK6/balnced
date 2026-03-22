"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  retirementAdviceCacheFingerprint,
  type RetirementAdviceGoalsSnapshot,
} from "@/lib/retirement-advice-inputs";

export type RetirementAdviceSnapshot = {
  currentAge: number;
  retirementAge: number;
  annualSalary: number;
  suggestedMonthlyInvest: number;
  projectedPortfolio: number;
  targetPortfolio: number;
  healthScorePercent: number;
  healthBand: string;
  yearsToRetirement: number;
  monthlyRetirementIncome: number;
  /** Fields that determine cache invalidation (salary, contribution, ages, goals). */
  goals: RetirementAdviceGoalsSnapshot | null;
};

const DEBOUNCE_MS = 900;

export default function RetirementAiAdvice({
  snapshot,
}: {
  snapshot: RetirementAdviceSnapshot | null;
}) {
  const [insights, setInsights] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");

  const cacheKey = useMemo(
    () =>
      snapshot
        ? retirementAdviceCacheFingerprint({
            annualSalary: snapshot.annualSalary,
            suggestedMonthlyInvest: snapshot.suggestedMonthlyInvest,
            retirementAge: snapshot.retirementAge,
            goals: snapshot.goals,
          })
        : "",
    [snapshot]
  );

  const fetchAdvice = useCallback(async (body: RetirementAdviceSnapshot) => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to load saved coaching tips.");
        setInsights(null);
        setFromCache(false);
        return;
      }

      const res = await fetch("/api/retirement-advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        insights?: string[];
        cached?: boolean;
        error?: string;
      };

      if (res.status === 401) {
        setError("Session expired—refresh the page to load coaching.");
        setInsights(null);
        setFromCache(false);
        return;
      }

      const list = Array.isArray(data.insights) ? data.insights.filter(Boolean) : [];
      setInsights(list.length ? list : null);
      setFromCache(Boolean(data.cached));
    } catch {
      setError("Couldn’t load coaching tips.");
      setInsights(null);
      setFromCache(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!snapshot || !cacheKey) {
      setInsights(null);
      setFromCache(false);
      lastKeyRef.current = "";
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (lastKeyRef.current === cacheKey) return;
      lastKeyRef.current = cacheKey;
      void fetchAdvice(snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [snapshot, cacheKey, fetchAdvice]);

  if (!snapshot) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 via-slate-900/40 to-slate-950/50 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:p-6"
      aria-labelledby="retirement-ai-advice-heading"
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-violet-200"
            aria-hidden
          >
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h3
              id="retirement-ai-advice-heading"
              className="text-lg font-semibold tracking-tight text-slate-50"
            >
              AI advice
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Short, personalized nudges from your current plan—not a full financial plan.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && fromCache && insights && insights.length > 0 ? (
            <span className="rounded-full border border-slate-600/50 bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Saved
            </span>
          ) : null}
          {loading ? (
            <span className="text-xs font-medium text-violet-200/80">Updating…</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && insights && insights.length > 0 ? (
        <ul className="mt-4 list-none space-y-2.5 p-0 text-sm leading-snug text-slate-200">
          {insights.map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 48)}`}
              className="relative pl-5 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-violet-400/90"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {loading && !insights?.length ? (
        <p className="mt-4 text-sm text-slate-500">Generating tips from your numbers…</p>
      ) : null}

      {!loading && !insights?.length && !error ? (
        <p className="mt-4 text-sm text-slate-500">No tips yet—add salary and ages to see coaching.</p>
      ) : null}
    </section>
  );
}
