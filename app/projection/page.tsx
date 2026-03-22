"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import DashboardShell from "@/components/dashboard/shell";
import DashboardPageHero, {
  DASHBOARD_PAGE_SECTION_GAP,
} from "@/components/dashboard/dashboard-page-hero";
import { DashboardPageBreadcrumb } from "@/components/dashboard/dashboard-page-breadcrumb";
import {
  loadDashboardData,
  formatDate,
  formatMoney,
  getNextPayday,
  getExpectedPaycheck,
  getRecurringPaydays,
  Budget,
  Bill,
  Expense,
  RecurringBill,
} from "@/lib/dashboard-data";
import {
  buildCashProjection,
  getWalletBalanceAfterExpenses,
} from "@/lib/cash-projection";
import ProFeatureTeaser from "@/components/dashboard/pro-feature-teaser";
import { useUserPlan } from "@/hooks/use-user-plan";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";
import ContextualUpgradeHint from "@/components/dashboard/contextual-upgrade-hint";
import UpgradeModal from "@/components/dashboard/upgrade-modal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function ProjectionPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const {
    planAccess,
    refresh: refreshPlanAccess,
    loading: planLoading,
    hasProAccess,
  } = useUserPlan();
  const isPro = !planLoading && hasProAccess;

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setBudget(data.budget);
      setBills(data.bills);
      setRecurringBills(data.recurringBills);
      setExpenses(data.expenses);
      setLoading(false);
    }
    load();
  }, []);

  const nextPayday = getNextPayday(budget);
  const expectedPaycheck = getExpectedPaycheck(budget);

  const projection = useMemo(
    () =>
      buildCashProjection({
        budget,
        bills,
        recurringBills,
        expenses,
        horizonPaychecks: 4,
      }),
    [budget, bills, recurringBills, expenses]
  );

  const {
    points: projectionData,
    balanceBeforeNextPayday: projectedBeforePayday,
    balanceAfterNextPayday: projectedAfterPayday,
    sumBillsBeforeNextPayday,
    billLinesBeforeNextPaydayCount,
  } = projection;

  const currentBalance = getWalletBalanceAfterExpenses(budget, expenses);

  const payScheduleForecast = useMemo(() => {
    const freq = budget?.pay_frequency;
    if (
      !nextPayday ||
      !budget ||
      (freq !== "weekly" && freq !== "biweekly") ||
      expectedPaycheck <= 0
    )
      return null;
    const paydaysPerYear = freq === "weekly" ? 52 : 26;
    const normalPerMonth = freq === "weekly" ? 4 : 2;
    const paydays = getRecurringPaydays(nextPayday, freq, paydaysPerYear);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = paydays.filter((d) => new Date(d) >= today);
    const byMonth: Record<
      string,
      { count: number; dates: string[]; income: number; hasExtra: boolean }
    > = {};
    for (const d of future) {
      const y = d.slice(0, 4);
      const m = d.slice(5, 7);
      const key = `${y}-${m}`;
      if (!byMonth[key])
        byMonth[key] = {
          count: 0,
          dates: [],
          income: 0,
          hasExtra: false,
        };
      byMonth[key].count += 1;
      byMonth[key].dates.push(d);
    }
    for (const key of Object.keys(byMonth)) {
      const row = byMonth[key];
      row.income = row.count * expectedPaycheck;
      row.hasExtra = row.count > normalPerMonth;
    }
    return {
      rows: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 12)
        .map(([month, data]) => ({ month, ...data })),
      normalPerMonth,
    };
  }, [budget, nextPayday, expectedPaycheck]);

  const projectionHeroStats = [
    {
      label: "Current balance",
      value: loading ? "…" : formatMoney(currentBalance),
      hint: "After logged expenses",
    },
    {
      label: "After next paycheck",
      value: loading ? "…" : formatMoney(projectedAfterPayday),
      hint: loading ? undefined : `+${formatMoney(expectedPaycheck)} paycheck`,
    },
    {
      label: "Bills before payday",
      value: loading
        ? "…"
        : `${billLinesBeforeNextPaydayCount} bill${billLinesBeforeNextPaydayCount !== 1 ? "s" : ""}`,
      hint:
        sumBillsBeforeNextPayday > 0
          ? `${formatMoney(sumBillsBeforeNextPayday)} total due`
          : "None in window",
    },
  ];

  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={<DashboardPageBreadcrumb current="Projection" />}
    >
      <div className={`flex h-full min-h-0 flex-col ${DASHBOARD_PAGE_SECTION_GAP}`}>
        <DashboardPageHero
          eyebrow="Cash runway"
          title="Projection"
          subtitle="Starting from your current balance (after logged expenses), minus bills due before payday, plus your next paycheck."
          icon={LineChartIcon}
          accent="cyan"
          stats={projectionHeroStats}
        />

        {!loading && !planLoading && !hasProAccess ? (
          <ContextualUpgradeHint
            hintId="projection_page"
            subline="Chart, timeline, and pay schedule are on Pro."
            onOpenDetails={() => setUpgradeModalOpen(true)}
          />
        ) : null}
        <UpgradeModal
          open={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          planAccess={planAccess}
          loadingPlan={loading || planLoading}
          onRefresh={refreshPlanAccess}
        />

        <div className="balnced-panel rounded-2xl border border-white/[0.08] bg-slate-950/35 p-5 sm:p-6">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
            Before next payday
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-100 sm:text-[1.65rem]">
            {loading ? "…" : formatMoney(projectedBeforePayday)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {!loading ? (
              <>
                Current {formatMoney(currentBalance)}
                {sumBillsBeforeNextPayday > 0
                  ? ` · Bills −${formatMoney(sumBillsBeforeNextPayday)}`
                  : ""}
              </>
            ) : (
              "Loading…"
            )}
          </p>
        </div>

        {planLoading ? (
          <div className={`w-full ${PRO_GATING_PLACEHOLDER_CLASS}`} aria-hidden />
        ) : isPro ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
            <h2 className="shrink-0 text-base font-semibold text-slate-100">
              Projection chart
            </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Balance after bills and paydays (same math as the timeline)
            </p>
          <div className="mt-4 h-64 min-h-[16rem] rounded-xl balnced-row">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={projectionData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="0"
                    stroke="#334155"
                    strokeOpacity={0.5}
                    vertical={false}
                    horizontal={true}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "2-digit",
                      })
                    }
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                    }
                    tickCount={5}
                    width={44}
                  />
                  <Tooltip
                    formatter={(value: unknown) => [
                      formatMoney(Number(value ?? 0)),
                      "Balance",
                    ]}
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #334155",
                      backgroundColor: "#0f172a",
                      color: "#f1f5f9",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        <div className="balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-100">Timeline</h2>

          <div className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {projectionData.map((item, index) => (
              <div
                key={`${item.date}-${item.title}-${index}`}
                className="flex flex-col gap-3 balnced-row rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                  <div>
                    <p className="font-medium text-slate-100">{item.title}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(item.date)}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="font-semibold text-slate-100">
                      {item.change >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(item.change))}
                    </p>
                    <p className="text-sm text-slate-500">
                      Balance: {formatMoney(item.balance)}
                    </p>
                  </div>
                </div>
              ))}

              {!loading && projectionData.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  No projection data yet.
                </p>
              )}
            </div>
          </div>
        </div>
        ) : (
          <ProFeatureTeaser title="Full projection runway" surface="projection" />
        )}

      {payScheduleForecast && isPro && (
        <div className="balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-100">
            Pay schedule forecast
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Monthly income by paycheck count. Months with an extra paycheck are highlighted.
          </p>
          <div className="mt-2 max-h-32 overflow-auto">
            <table className="w-full min-w-[320px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className="pb-3 text-left text-sm font-medium text-slate-600 dark:text-slate-400">
                    Month
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-600 dark:text-slate-400">
                    Paychecks
                  </th>
                  <th className="pb-3 text-right text-sm font-medium text-slate-600 dark:text-slate-400">
                    Income
                  </th>
                </tr>
              </thead>
              <tbody>
                {payScheduleForecast.rows.map(({ month, count, income, hasExtra }) => (
                  <tr
                    key={month}
                    className={`border-b border-slate-100 dark:border-slate-700/50 ${
                      hasExtra ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                    }`}
                  >
                    <td className="py-3">
                      <span className="font-medium text-slate-100">
                        {new Date(month + "-01").toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      {hasExtra && (
                        <span className="ml-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                          +1
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-700 dark:text-slate-300">
                      {count}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-100">
                      {formatMoney(income)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </DashboardShell>
  );
}
