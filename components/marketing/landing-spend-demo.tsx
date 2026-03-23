"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/dashboard-data";

/**
 * Lightweight marketing calculator — illustrative only, not connected to real Balnced logic.
 * Placed mid-page to let visitors “feel” the core outcome before signup.
 */
export function LandingSpendDemo() {
  const [paycheck, setPaycheck] = useState(3200);
  const [bills, setBills] = useState(1850);
  const [days, setDays] = useState(14);

  const daily = useMemo(() => {
    const left = Math.max(0, paycheck - bills);
    const d = Math.max(1, days);
    return left / d;
  }, [paycheck, bills, days]);

  return (
    <div className="rounded-[1.75rem] border border-white/[0.08] bg-slate-950/55 px-5 py-8 backdrop-blur-sm sm:px-8 sm:py-9">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
        Try it
      </p>
      <h2 className="mt-2 text-center text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
        Try your safe spend per day
      </h2>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-500">
        Quick illustration—Balnced uses your real paydays, bills, and balance.
      </p>

      <div className="mx-auto mt-8 grid max-w-lg gap-4 sm:grid-cols-3">
        <label className="block text-left">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
            Paycheck
          </span>
          <input
            type="number"
            min={0}
            step={50}
            value={paycheck}
            onChange={(e) => setPaycheck(Number(e.target.value) || 0)}
            className="balnced-input mt-1.5 w-full tabular-nums"
            aria-label="Paycheck amount"
          />
        </label>
        <label className="block text-left">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
            Bills (period)
          </span>
          <input
            type="number"
            min={0}
            step={25}
            value={bills}
            onChange={(e) => setBills(Number(e.target.value) || 0)}
            className="balnced-input mt-1.5 w-full tabular-nums"
            aria-label="Total bills until next payday"
          />
        </label>
        <label className="block text-left">
          <span className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
            Days until payday
          </span>
          <input
            type="number"
            min={1}
            max={31}
            step={1}
            value={days}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            className="balnced-input mt-1.5 w-full tabular-nums"
            aria-label="Days until payday"
          />
        </label>
      </div>

      <div className="mx-auto mt-8 max-w-md rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-600/20 to-slate-900/80 px-5 py-5 text-center">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-200/85">
          You could safely spend about
        </p>
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-white sm:text-4xl">
          {formatMoney(daily)}
        </p>
        <p className="mt-1 text-xs text-emerald-100/70">per day (illustrative)</p>
      </div>
    </div>
  );
}
