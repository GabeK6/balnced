"use client";

import Link from "next/link";

export type BalncedLogoSize = "sm" | "md" | "lg";

const sizeClasses: Record<
  BalncedLogoSize,
  { mark: string; wordmark: string }
> = {
  sm: { mark: "h-7 w-7", wordmark: "text-base" },
  md: { mark: "h-8 w-8", wordmark: "text-lg" },
  lg: { mark: "h-9 w-9 sm:h-10 sm:w-10", wordmark: "text-lg sm:text-2xl" },
};

/** Icon-only mark — two balanced bars in a soft emerald frame (calm “equilibrium” motif). */
export function BalncedMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        className="stroke-emerald-500/45"
        strokeWidth="1.25"
      />
      <path
        d="M7 10h10M7 14h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-emerald-400"
      />
    </svg>
  );
}

type Props = {
  size?: BalncedLogoSize;
  /** Dashboard default; use `/` for marketing/auth. */
  href?: string | null;
  className?: string;
  /** Override wordmark color (e.g. muted nav link). */
  wordmarkClassName?: string;
  iconOnly?: boolean;
};

export default function BalncedLogo({
  size = "md",
  href = "/dashboard",
  className = "",
  wordmarkClassName = "",
  iconOnly = false,
}: Props) {
  const s = sizeClasses[size];
  const inner = (
    <>
      <BalncedMark className={`${s.mark} shrink-0`} />
      {!iconOnly ? (
        <span
          className={`font-semibold tracking-tight text-slate-50 ${s.wordmark} ${wordmarkClassName}`}
        >
          Balnced
        </span>
      ) : null}
    </>
  );

  const cls = `inline-flex items-center gap-2.5 rounded-lg ${className}`;

  if (href === null) {
    return <span className={cls}>{inner}</span>;
  }

  return (
    <Link href={href} className={cls} aria-label="Balnced home">
      {inner}
    </Link>
  );
}
