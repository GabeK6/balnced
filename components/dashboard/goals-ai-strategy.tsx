"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isProRequiredApiError, proRequiredFriendlyMessage } from "@/lib/upgrade-prompt";
import { TRUST_DISCLAIMER } from "@/lib/trust-copy";

export type GoalsStrategyPayload = {
  monthlyTakeHome: number;
  savePercent: number;
  monthlySavingsPlan: number;
  goals: {
    priority: number;
    name: string;
    amount: number;
    monthsToFund: number | null;
    targetMonthLabel: string | null;
  }[];
};

const DEBOUNCE_MS = 850;

type Props = {
  payload: GoalsStrategyPayload | null;
};

export default function GoalsAiStrategy({ payload }: Props) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string>("");

  const fingerprint = useMemo(() => (payload ? JSON.stringify(payload) : ""), [payload]);

  const fetchStrategy = useCallback(async (body: GoalsStrategyPayload) => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in to load AI strategy.");
        setSuggestions(null);
        return;
      }

      const res = await fetch("/api/goals-strategy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { suggestions?: string[]; error?: string };

      if (res.status === 401) {
        setError("Session expired — refresh the page.");
        setSuggestions(null);
        return;
      }

      if (res.status === 403 || isProRequiredApiError(data.error)) {
        setError(proRequiredFriendlyMessage());
        setSuggestions(null);
        return;
      }

      const list = Array.isArray(data.suggestions)
        ? data.suggestions.filter(Boolean)
        : [];
      setSuggestions(list.length ? list : null);
    } catch {
      setError("Couldn’t load AI strategy.");
      setSuggestions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!payload || !fingerprint) {
      setSuggestions(null);
      lastKeyRef.current = "";
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (lastKeyRef.current === fingerprint) return;
      lastKeyRef.current = fingerprint;
      void fetchStrategy(payload);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [payload, fingerprint, fetchStrategy]);

  if (!payload || payload.goals.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-teal-500/25 bg-gradient-to-br from-teal-950/35 via-slate-900/45 to-slate-950/55 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition duration-300 ease-out motion-reduce:transition-none hover:border-teal-400/35 sm:hover:-translate-y-0.5 sm:hover:shadow-lg sm:hover:shadow-black/25"
      aria-labelledby="goals-ai-strategy-heading"
    >
      <div className="flex flex-wrap items-start gap-3 sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15 text-teal-200"
            aria-hidden
          >
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-teal-200/80">
              AI strategy
            </p>
            <h2
              id="goals-ai-strategy-heading"
              className="text-xl font-semibold tracking-tight text-slate-50"
            >
              Ideas to reach goals faster
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Based on your priorities and save % (not the what-if slider). {TRUST_DISCLAIMER}
            </p>
          </div>
        </div>
        {loading ? (
          <span className="text-xs font-medium text-teal-200/80">Thinking…</span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && suggestions && suggestions.length > 0 ? (
        <ul className="mt-5 list-none space-y-3 p-0 text-sm leading-relaxed text-slate-200">
          {suggestions.map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 40)}`}
              className="relative pl-5 before:absolute before:left-0 before:top-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-teal-400/90"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}

      {loading && !suggestions?.length ? (
        <p className="mt-4 text-sm text-slate-500">Generating suggestions from your goals…</p>
      ) : null}

      {!loading && !suggestions?.length && !error ? (
        <p className="mt-4 text-sm text-slate-500">No suggestions yet.</p>
      ) : null}
    </section>
  );
}
