"use client";

import Link from "next/link";
import type { OverviewAlert } from "@/lib/overview-alerts";

type Props = {
  alerts: OverviewAlert[];
};

function severityStyles(severity: OverviewAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-500/30 bg-rose-950/35 text-rose-50";
    case "warning":
      return "border-amber-500/25 bg-amber-950/25 text-amber-50";
    default:
      return "border-sky-500/20 bg-sky-950/20 text-sky-50";
  }
}

/**
 * Compact alert strip — only rendered when `alerts.length > 0`.
 */
export default function OverviewAlerts({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-2 sm:gap-2.5"
      role="region"
      aria-label="Important alerts"
    >
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 transition duration-200 ease-out hover:-translate-y-px hover:shadow-md motion-reduce:transform-none motion-reduce:hover:transform-none sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${severityStyles(a.severity)}`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{a.title}</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{a.message}</p>
          </div>
          <Link
            href={a.href}
            className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-center text-xs font-semibold transition hover:bg-white/10 sm:py-2 sm:text-sm"
          >
            {a.linkLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
