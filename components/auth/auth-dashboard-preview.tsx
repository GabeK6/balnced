/**
 * Decorative-only dashboard preview for auth pages (not interactive).
 */
export function AuthDashboardPreview() {
  return (
    <div
      className="balnced-panel relative overflow-hidden rounded-2xl p-4 shadow-lg ring-1 ring-white/[0.06]"
      aria-hidden
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-400/90">
            Snapshot
          </span>
          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[0.65rem] text-slate-400">
            This month
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/[0.07] bg-slate-900/60 p-2.5">
            <p className="text-[0.65rem] text-slate-500">Wallet available</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-300">$412</p>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-slate-900/60 p-2.5">
            <p className="text-[0.65rem] text-slate-500">Bills due</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-200">$186</p>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-slate-900/60 p-2.5">
            <p className="text-[0.65rem] text-slate-500">Goal progress</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-200">68%</p>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-slate-900/60 p-2.5">
            <p className="text-[0.65rem] text-slate-500">Debt</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-amber-200/95">$4.2k</p>
          </div>
        </div>

        <div className="mt-3 flex h-16 items-end gap-1.5 rounded-lg border border-white/[0.06] bg-slate-950/50 px-2 pb-2 pt-3">
          {[40, 65, 35, 80, 55, 90, 48].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-emerald-600/80 to-emerald-400/50"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-2 w-3/4 max-w-[8rem] rounded bg-white/[0.08]" />
            <div className="h-2 w-1/2 max-w-[5rem] rounded bg-white/[0.05]" />
          </div>
        </div>
      </div>
    </div>
  );
}
