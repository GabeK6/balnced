import type { ReactNode } from "react";

type Props = {
  formPanel: ReactNode;
  brandedPanel: ReactNode;
};

/**
 * Shared two-column auth layout: form first on mobile, brand left + form right on desktop.
 */
export function AuthPageShell({ formPanel, brandedPanel }: Props) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(16,185,129,0.14),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_50%,rgba(56,189,248,0.08),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-[120rem] lg:grid-cols-2">
        <div className="order-1 flex flex-col justify-center px-4 py-10 sm:px-8 sm:py-14 lg:order-2 lg:px-10 lg:py-16 xl:px-16">
          {formPanel}
        </div>

        <div className="order-2 relative flex flex-col justify-center border-t border-white/[0.06] px-4 pb-12 pt-6 sm:px-8 lg:order-1 lg:border-t-0 lg:border-r lg:border-white/[0.06] lg:pb-16 lg:pt-16 lg:pr-10 xl:px-16">
          {brandedPanel}
        </div>
      </div>
    </main>
  );
}
