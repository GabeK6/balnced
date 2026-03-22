"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { Expense } from "@/lib/dashboard-data";
import {
  computeExpenseLoggingStreak,
  localDateKey,
  readDailyEngagement,
  writeDailyEngagementSawSafe,
} from "@/lib/daily-engagement";

type Props = {
  userId: string;
  expenses: Expense[];
};

export default function DailyEngagementCard({ userId, expenses }: Props) {
  const todayKey = useMemo(() => localDateKey(new Date()), [expenses]);

  const { streak, loggedToday } = useMemo(
    () => computeExpenseLoggingStreak(expenses, new Date()),
    [expenses]
  );

  const [sawSafeToSpend, setSawSafeToSpend] = useState(false);

  useEffect(() => {
    const stored = readDailyEngagement(userId, todayKey);
    if (stored?.sawSafeToSpend) {
      setSawSafeToSpend(true);
      return;
    }

    const el = document.getElementById("safe-to-spend");
    if (!el) return;

    const mark = () => {
      writeDailyEngagementSawSafe(userId, todayKey);
      setSawSafeToSpend(true);
    };

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) {
          mark();
          obs.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -5% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [userId, todayKey]);

  const bothDone = loggedToday && sawSafeToSpend;

  return (
    <section
      className="rounded-2xl border border-white/[0.07] bg-slate-950/50 px-4 py-4 sm:px-5 sm:py-4"
      aria-label="Today’s habits"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Today
          </p>
          <p className="mt-1 text-sm font-medium text-slate-200">A quick daily check</p>
        </div>
        {streak >= 2 ? (
          <p className="text-xs leading-snug text-slate-400 sm:max-w-[15rem] sm:text-right">
            You’ve logged spending {streak} days in a row.
          </p>
        ) : streak === 1 ? (
          <p className="text-xs leading-snug text-slate-400 sm:max-w-[15rem] sm:text-right">
            {loggedToday
              ? "One day down — come back tomorrow."
              : "Log spending today to keep your streak."}
          </p>
        ) : (
          <p className="text-xs text-slate-500 sm:text-right">
            Log spending on consecutive days to build a streak.
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        <li>
          <Link
            href="/expenses#add-expense"
            className="flex items-start gap-3 rounded-xl border border-transparent px-1 py-0.5 transition hover:border-white/[0.06] hover:bg-white/[0.03]"
          >
            <span className="mt-0.5 text-emerald-500/90" aria-hidden>
              {loggedToday ? (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Circle className="h-4 w-4 opacity-60" strokeWidth={2} />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-100">
                Log today’s spending
              </span>
              <span className="balnced-text-muted text-xs">
                {loggedToday ? "Done for today." : "Keeps your daily limit accurate."}
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="#safe-to-spend"
            className="flex items-start gap-3 rounded-xl border border-transparent px-1 py-0.5 transition hover:border-white/[0.06] hover:bg-white/[0.03]"
            onClick={() => {
              writeDailyEngagementSawSafe(userId, todayKey);
              setSawSafeToSpend(true);
            }}
          >
            <span className="mt-0.5 text-emerald-500/90" aria-hidden>
              {sawSafeToSpend ? (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Circle className="h-4 w-4 opacity-60" strokeWidth={2} />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-100">
                Check your safe-to-spend
              </span>
              <span className="balnced-text-muted text-xs">
                {sawSafeToSpend
                  ? "You’ve seen today’s number."
                  : "Glance at your hero card above when you’re ready."}
              </span>
            </span>
          </Link>
        </li>
      </ul>

      {bothDone ? (
        <p className="mt-4 border-t border-white/[0.06] pt-3 text-sm text-emerald-400/95">
          Nice — you’re on top of today.
        </p>
      ) : null}
    </section>
  );
}
