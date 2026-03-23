/**
 * Full-viewport atmospheric layers for centered login (non-interactive).
 * Calm gradients + soft vignette — no grid or watermark.
 */
export function AuthLoginAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft radial washes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_-10%,rgba(16,185,129,0.1),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_95%_15%,rgba(56,189,248,0.06),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_50%_at_5%_85%,rgba(16,185,129,0.05),transparent_52%)]" />

      {/* Smooth depth / center lift */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_50%,transparent_35%,rgba(2,6,23,0.55)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950" />

      {/* Edge vignette — anchors composition without feeling heavy */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_52%,rgba(0,0,0,0.28)_100%)]" />

      {/* Distant glow falloff */}
      <div className="absolute -left-40 top-1/3 h-80 w-80 rounded-full bg-emerald-500/[0.07] blur-[120px]" />
      <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-slate-600/[0.06] blur-[130px]" />
    </div>
  );
}
