import type { FinancialStatus } from "@/lib/financial-status";
import type { Bill, RecurringBill } from "@/lib/dashboard-data";
import { getOverdueBills } from "@/lib/recurring-bill-occurrences";

export type OverviewAlertSeverity = "critical" | "warning" | "info";

export type OverviewAlert = {
  id: string;
  severity: OverviewAlertSeverity;
  title: string;
  message: string;
  href: string;
  linkLabel: string;
};

const MAX_ALERTS = 3;
/** Combined save + invest below this (when income exists) triggers a low-savings alert. */
const LOW_SAVINGS_PCT = 8;

/**
 * High-signal alerts only (overspending, overdue bills, low savings rate).
 * No API calls — uses the same bill / budget data as the rest of Overview.
 */
export function computeOverviewAlerts(params: {
  recurringBills: RecurringBill[];
  bills: Bill[];
  safeToSpend: number;
  financialStatus: FinancialStatus;
  savePercent: number;
  investPercent: number;
  monthlyPay: number;
  now?: Date;
}): OverviewAlert[] {
  const now = params.now ?? new Date();
  const out: OverviewAlert[] = [];

  if (params.financialStatus === "overspending") {
    out.push({
      id: "overspending",
      severity: "critical",
      title: "You are overspending",
      message:
        "Safe to spend is exhausted at your current pace. Slow discretionary spending until payday.",
      href: "/expenses",
      linkLabel: "Review expenses",
    });
  }

  const overdue = getOverdueBills(params.recurringBills, params.bills, now);
  if (overdue.length > 0) {
    out.push({
      id: "overdue-bills",
      severity: "warning",
      title: "You have overdue bills",
      message:
        overdue.length === 1
          ? `${overdue[0].recurringBill.name} looks unpaid past its due date.`
          : `${overdue.length} bills look unpaid past their due dates.`,
      href: "/bills",
      linkLabel: "View bills",
    });
  }

  const savingsRate = params.savePercent + params.investPercent;
  if (
    params.monthlyPay > 0 &&
    savingsRate < LOW_SAVINGS_PCT &&
    params.financialStatus !== "overspending"
  ) {
    out.push({
      id: "low-savings",
      severity: "info",
      title: "Your savings rate is low",
      message: `Combined save + invest is ${Math.round(savingsRate)}% of take-home. Even a small bump helps.`,
      href: "/goals",
      linkLabel: "Adjust goals",
    });
  }

  return out.slice(0, MAX_ALERTS);
}
