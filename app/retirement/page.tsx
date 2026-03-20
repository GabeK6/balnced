"use client";

import DashboardShell from "@/components/dashboard/shell";
import InvestmentsPanel from "@/components/dashboard/investments-panel";
import RetirementPlanner from "@/components/dashboard/retirement-planner";

export default function RetirementPage() {
  return (
    <DashboardShell
      title="Retirement"
      subtitle="Roth, 401(k), and projections — plus contribution target and AI advice below."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <div className="grid h-full min-h-0 gap-5 sm:gap-6 lg:grid-cols-1">
        <RetirementPlanner />
        <InvestmentsPanel showSuggestedMonthly={false} />
      </div>
    </DashboardShell>
  );
}
