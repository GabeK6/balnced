"use client";

import Link from "next/link";
import DashboardShell from "@/components/dashboard/shell";
import InvestmentsPanel from "@/components/dashboard/investments-panel";
import RetirementPlanner from "@/components/dashboard/retirement-planner";

export default function RetirementPage() {
  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={
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
            Retirement
          </span>
        </nav>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-1">
        <RetirementPlanner />
        <div className="balnced-panel rounded-3xl p-6 sm:p-8">
          <div className="mb-5 border-b border-white/[0.06] pb-4">
            <h2 className="text-lg font-semibold tracking-tight text-slate-100">Guidance</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              AI suggestions based on your income, plan, and goals.
            </p>
          </div>
          <InvestmentsPanel showSuggestedMonthly={false} />
        </div>
      </div>
    </DashboardShell>
  );
}
