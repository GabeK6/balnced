import BalncedLogo from "@/components/brand/balnced-logo";
import { AuthDashboardPreview } from "@/components/auth/auth-dashboard-preview";

export type AuthBrandedPanelProps = {
  headline: string;
  supporting: string;
  features: readonly string[];
  mobileHeadline: string;
  mobileSupporting: string;
};

function FeatureBullet({ children }: { children: string }) {
  return (
    <li className="flex gap-3 text-[0.95rem] leading-snug text-slate-300">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
        aria-hidden
      >
        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6l2.5 2.5L9.5 3" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

export function AuthBrandedPanel({
  headline,
  supporting,
  features,
  mobileHeadline,
  mobileSupporting,
}: AuthBrandedPanelProps) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_20%_40%,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-lg lg:mx-0">
        <div className="hidden lg:block">
          <BalncedLogo size="lg" href="/" />
          <p className="balnced-eyebrow mt-8">Balnced</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl xl:text-[2.35rem] xl:leading-[1.15]">
            {headline}
          </p>
          <p className="balnced-text-muted mt-4 max-w-md text-base leading-relaxed sm:text-lg">
            {supporting}
          </p>
          <ul className="mt-8 space-y-3.5">
            {features.map((line) => (
              <FeatureBullet key={line}>{line}</FeatureBullet>
            ))}
          </ul>
          <div className="mt-10">
            <AuthDashboardPreview />
          </div>
        </div>

        <div className="lg:hidden">
          <p className="text-center text-lg font-semibold tracking-tight text-slate-100">
            {mobileHeadline}
          </p>
          <p className="balnced-text-muted mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed">
            {mobileSupporting}
          </p>
          <div className="mt-6">
            <AuthDashboardPreview />
          </div>
        </div>
      </div>
    </>
  );
}
