"use client";

import Link from "next/link";

export type SectionEmptyStateProps = {
  title: string;
  description: string;
  example?: string;
  /** Primary CTA — use `actionHref` for in-page anchors (`#id`) or routes. */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  /** `panel`: dashed card (default). `inline`: text + optional CTA only, for nested cards. */
  variant?: "panel" | "inline";
  /** `center` for hero-style blocks (e.g. charts). */
  align?: "start" | "center";
};

const btnClass =
  "inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-950/30 transition hover:bg-emerald-500 active:scale-[0.99] motion-reduce:active:scale-100";

function ActionButton({
  label,
  href,
  onAction,
}: {
  label: string;
  href?: string;
  onAction?: () => void;
}) {
  if (href) {
    if (href.startsWith("#")) {
      return (
        <a href={href} className={btnClass}>
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={btnClass}>
        {label}
      </Link>
    );
  }
  if (onAction) {
    return (
      <button type="button" onClick={onAction} className={btnClass}>
        {label}
      </button>
    );
  }
  return null;
}

export default function SectionEmptyState({
  title,
  description,
  example,
  actionLabel,
  actionHref,
  onAction,
  className = "",
  variant = "panel",
  align = "start",
}: SectionEmptyStateProps) {
  const showAction = Boolean(actionLabel && (actionHref || onAction));
  const alignClass = align === "center" ? "text-center" : "";

  if (variant === "inline") {
    return (
      <div className={`space-y-2 ${alignClass} ${className}`}>
        <p className="text-sm font-medium text-slate-200">{title}</p>
        <p className="text-xs leading-relaxed text-slate-500">{description}</p>
        {example ? (
          <p className="text-[11px] italic leading-relaxed text-slate-600">{example}</p>
        ) : null}
        {showAction && actionLabel ? (
          <div className={`pt-1 ${align === "center" ? "flex justify-center" : ""}`}>
            <ActionButton label={actionLabel} href={actionHref} onAction={onAction} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-dashed border-white/15 bg-slate-950/30 p-5 ${alignClass} ${className}`}
    >
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{description}</p>
      {example ? (
        <p className="mt-2 text-[11px] italic leading-relaxed text-slate-600">{example}</p>
      ) : null}
      {showAction && actionLabel ? (
        <div className={`mt-3 ${align === "center" ? "flex justify-center" : ""}`}>
          <ActionButton label={actionLabel} href={actionHref} onAction={onAction} />
        </div>
      ) : null}
    </div>
  );
}
