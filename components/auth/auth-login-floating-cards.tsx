/**
 * Two ambient mini cards only — low contrast, pushed toward viewport edges.
 */

function FloatingMiniCard({
  label,
  value,
  valueClassName,
  decoration,
}: {
  label: string;
  value: string;
  valueClassName: string;
  decoration: "bar" | "lines";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-slate-950/25 p-3.5 shadow-lg ring-1 ring-white/[0.04]">
      <p className="text-[0.6rem] font-medium uppercase tracking-[0.08em] text-slate-500/90">
        {label}
      </p>
      <p className={`mt-1.5 text-lg font-semibold tracking-tight tabular-nums ${valueClassName}`}>
        {value}
      </p>
      {decoration === "bar" ? (
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-emerald-600/60 to-emerald-400/40" />
        </div>
      ) : (
        <div className="mt-2.5 space-y-1">
          <div className="h-1 w-4/5 rounded bg-white/[0.05]" />
          <div className="h-1 w-3/5 rounded bg-white/[0.035]" />
        </div>
      )}
    </div>
  );
}

export function AuthLoginFloatingCards() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] hidden overflow-hidden md:block"
      aria-hidden
    >
      {/* Top-left — pushed toward edge */}
      <div className="absolute left-2 top-[8%] w-[min(15rem,22vw)] -rotate-[3deg] opacity-[0.07] blur-sm sm:left-4 md:left-8 lg:left-12 xl:left-16 xl:top-[10%] xl:opacity-[0.09]">
        <FloatingMiniCard
          label="Wallet available"
          value="$412"
          valueClassName="text-emerald-400/90"
          decoration="bar"
        />
      </div>

      {/* Top-right — pushed toward edge */}
      <div className="absolute right-2 top-[14%] w-[min(15rem,22vw)] rotate-[2deg] opacity-[0.07] blur-sm sm:right-4 md:right-8 lg:right-12 xl:right-16 xl:top-[16%] xl:opacity-[0.09]">
        <FloatingMiniCard
          label="Bills due"
          value="$186"
          valueClassName="text-slate-300/90"
          decoration="lines"
        />
      </div>
    </div>
  );
}
