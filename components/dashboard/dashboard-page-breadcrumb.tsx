import Link from "next/link";

/** Matches Goals / Retirement: Overview / Current page */
export function DashboardPageBreadcrumb({ current }: { current: string }) {
  return (
    <nav
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
      aria-label="Breadcrumb"
    >
      <Link
        href="/dashboard"
        className="text-slate-500 transition-colors duration-150 hover:text-slate-300 motion-reduce:transition-none"
      >
        Overview
      </Link>
      <span className="text-slate-600" aria-hidden>
        /
      </span>
      <span className="font-medium text-slate-200" aria-current="page">
        {current}
      </span>
    </nav>
  );
}
