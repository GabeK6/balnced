"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import DashboardShell from "@/components/dashboard/shell";
import DashboardPageHero, {
  DASHBOARD_PAGE_SECTION_GAP,
} from "@/components/dashboard/dashboard-page-hero";
import { DashboardPageBreadcrumb } from "@/components/dashboard/dashboard-page-breadcrumb";
import CategoryInsightsPanel from "@/components/dashboard/category-insights-panel";
import ExpensePostFeedback from "@/components/dashboard/expense-post-feedback";
import ExpensesSummaryDashboard from "@/components/dashboard/expenses-summary-dashboard";
import ExpensesCategoryChart from "@/components/dashboard/expenses-category-chart";
import ExpensesFreeCategoryList from "@/components/dashboard/expenses-free-category-list";
import ExpensesSpendingLineChart from "@/components/dashboard/expenses-spending-line-chart";
import ExpensesProBudgetsPanel from "@/components/dashboard/expenses-pro-budgets-panel";
import ExpensesProInsightsPanel from "@/components/dashboard/expenses-pro-insights-panel";
import ExpensesProDailyCard from "@/components/dashboard/expenses-pro-daily-card";
import ExpensesProLockedSection from "@/components/dashboard/expenses-pro-locked-section";
import { useUserPlan } from "@/hooks/use-user-plan";
import { PRO_GATING_PLACEHOLDER_CLASS } from "@/lib/plan-ui";
import {
  loadDashboardData,
  Expense,
  Budget,
  Bill,
  RecurringBill,
  formatMoney,
} from "@/lib/dashboard-data";
import {
  computeCategoryInsights,
  computeExpensesSafeGuidance,
  computePostExpenseFeedback,
  computeRemainingSafeToSpend,
  dailyAverageThisMonth,
  getThisMonthSpending,
  largestCategoryThisMonth,
  weekOverWeekTrend,
  spendingByCategoryThisMonthChart,
  type PostExpenseFeedback,
} from "@/lib/expense-dashboard-summaries";
import RecentExpensesList from "@/components/dashboard/recent-expenses-list";
import { useWalletBalance } from "@/components/dashboard/wallet-balance-context";
import { supabase } from "@/lib/supabase";
import {
  rememberCategoryChoice,
  loadLearnedCategories,
  suggestCategory,
  type ExpenseCategoryOption,
} from "@/lib/expense-smart-category";
import {
  loadCategoryBudgets,
  setCategoryBudget,
  yearMonthKey,
  type CategoryBudgetsByMonth,
} from "@/lib/expense-category-budgets";

export default function ExpensesPage() {
  const { refresh: refreshWalletBalance } = useWalletBalance();
  const { hasProAccess, loading: planLoading } = useUserPlan();
  const proReady = !planLoading;
  const isPro = proReady && hasProAccess;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [postExpenseFeedback, setPostExpenseFeedback] =
    useState<PostExpenseFeedback | null>(null);
  const [feedbackAnimKey, setFeedbackAnimKey] = useState(0);
  const [addPanelFlash, setAddPanelFlash] = useState(false);
  const [learnedCategories, setLearnedCategories] = useState<
    Record<string, ExpenseCategoryOption>
  >({});
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetsByMonth>({});

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setUserId(data.user.id);
      setBudget(data.budget);
      setBills(data.bills);
      setRecurringBills(data.recurringBills);
      setExpenses(data.expenses);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;
    setLearnedCategories(loadLearnedCategories(userId));
    setCategoryBudgets(loadCategoryBudgets(userId));
  }, [userId]);

  const suggestedCategory = useMemo(
    () => (userId ? suggestCategory(name, learnedCategories) : null),
    [name, learnedCategories, userId]
  );

  useEffect(() => {
    if (!postExpenseFeedback) return;
    const t = window.setTimeout(() => setPostExpenseFeedback(null), 10000);
    return () => clearTimeout(t);
  }, [postExpenseFeedback]);

  const categoryTotals = useMemo(() => {
    return expenses.reduce(
      (acc, expense) => {
        const key = expense.category || "Other";
        acc[key] = (acc[key] || 0) + Number(expense.amount);
        return acc;
      },
      {} as Record<string, number>
    );
  }, [expenses]);

  const thisMonthTotal = useMemo(
    () => getThisMonthSpending(expenses, new Date()),
    [expenses]
  );
  const dailyAvg = useMemo(
    () => dailyAverageThisMonth(expenses, new Date()),
    [expenses]
  );
  const safeToSpend = useMemo(
    () =>
      computeRemainingSafeToSpend(
        budget,
        bills,
        recurringBills,
        expenses,
        userId,
        new Date()
      ),
    [budget, bills, recurringBills, expenses, userId]
  );
  const safeGuidance = useMemo(
    () =>
      computeExpensesSafeGuidance(
        budget,
        bills,
        recurringBills,
        expenses,
        userId,
        new Date()
      ),
    [budget, bills, recurringBills, expenses, userId]
  );
  const topCategoryMonth = useMemo(
    () => largestCategoryThisMonth(expenses, new Date()),
    [expenses]
  );
  const weekTrend = useMemo(
    () => weekOverWeekTrend(expenses, new Date()),
    [expenses]
  );

  const categoryChartData = useMemo(
    () => spendingByCategoryThisMonthChart(expenses, new Date()),
    [expenses]
  );

  const categoryInsights = useMemo(
    () => computeCategoryInsights(expenses, new Date()),
    [expenses]
  );

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        name,
        amount: Number(amount),
        category,
        archived: false,
      })
      .select("*")
      .single();

    if (error) return alert("Could not save expense.");

    const newExpense = data as Expense;
    const nextExpenses = [newExpense, ...expenses];
    setExpenses(nextExpenses);

    if (userId && category) {
      setLearnedCategories((prev) =>
        rememberCategoryChoice(userId, name, category as ExpenseCategoryOption, prev)
      );
    }

    setName("");
    setAmount("");
    setCategory("");

    const g = computeExpensesSafeGuidance(
      budget,
      bills,
      recurringBills,
      nextExpenses,
      userId,
      new Date()
    );
    setPostExpenseFeedback(computePostExpenseFeedback(g));
    setFeedbackAnimKey((k) => k + 1);
    setAddPanelFlash(true);
    window.setTimeout(() => setAddPanelFlash(false), 750);
    void refreshWalletBalance();
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return alert("Could not delete expense.");
    setExpenses((prev) => prev.filter((expense) => expense.id !== id));
    void refreshWalletBalance();
  }

  function handleBudgetBlur(cat: ExpenseCategoryOption, raw: string) {
    if (!userId) return;
    const n = parseFloat(raw);
    const amount = Number.isFinite(n) ? n : 0;
    const ym = yearMonthKey(new Date());
    setCategoryBudgets((prev) => setCategoryBudget(userId, ym, cat, amount, prev));
  }

  const heroStats = [
    {
      label: "Spent this month",
      value: loading ? "…" : formatMoney(thisMonthTotal),
      hint: "Month-to-date",
    },
    {
      label: "Daily average",
      value: loading ? "…" : formatMoney(dailyAvg),
      hint: "This month",
    },
    {
      label: "Top category",
      value: loading
        ? "…"
        : topCategoryMonth
          ? topCategoryMonth.name
          : "—",
      hint: loading
        ? undefined
        : topCategoryMonth
          ? formatMoney(topCategoryMonth.amount)
          : "No spending yet",
    },
  ];

  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={<DashboardPageBreadcrumb current="Expenses" />}
    >
      <div className={`mx-auto max-w-7xl ${DASHBOARD_PAGE_SECTION_GAP}`}>
        <DashboardPageHero
          eyebrow="Spending"
          title="Expenses"
          subtitle="Month-to-date picture, category mix, and quick logging—built for clarity."
          icon={Receipt}
          accent="emerald"
          stats={heroStats}
        />

        <section aria-label="Summary" className="scroll-mt-4">
          <ExpensesSummaryDashboard
            loading={loading}
            guidance={safeGuidance}
            thisMonthTotal={thisMonthTotal}
            dailyAverage={dailyAvg}
            safeToSpend={safeToSpend}
            topCategory={topCategoryMonth}
            weekTrend={weekTrend}
          />
        </section>

        {planLoading ? (
          <div
            className={`${PRO_GATING_PLACEHOLDER_CLASS} min-h-[20rem] scroll-mt-4`}
            aria-busy
            aria-label="Loading subscription"
          />
        ) : isPro ? (
          <>
            <section aria-label="Pro analytics" className="scroll-mt-4">
              <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                <ExpensesSpendingLineChart expenses={expenses} days={30} />
                <ExpensesCategoryChart
                  data={categoryChartData}
                  loading={loading}
                  monthTotal={thisMonthTotal}
                />
              </div>
            </section>

            <section aria-label="Pro daily limit" className="scroll-mt-4">
              <ExpensesProDailyCard guidance={safeGuidance} />
            </section>

            <section aria-label="Pro category budgets" className="scroll-mt-4">
              <ExpensesProBudgetsPanel
                expenses={expenses}
                now={new Date()}
                budgets={categoryBudgets}
                onBudgetChange={handleBudgetBlur}
              />
            </section>

            <section aria-label="Pro spending insights" className="scroll-mt-4">
              <ExpensesProInsightsPanel expenses={expenses} now={new Date()} />
            </section>
          </>
        ) : (
          <>
            <section aria-label="Spending by category" className="scroll-mt-4">
              <ExpensesFreeCategoryList data={categoryChartData} monthTotal={thisMonthTotal} />
            </section>
            <section aria-label="Pro expenses preview" className="scroll-mt-4">
              <ExpensesProLockedSection />
            </section>
          </>
        )}

        <section
          aria-labelledby="expenses-heading"
          className="scroll-mt-4 space-y-5"
        >
          <header className="border-b border-white/[0.06] pb-4">
            <h2
              id="expenses-heading"
              className="text-lg font-semibold tracking-tight text-slate-50 sm:text-xl"
            >
              Log &amp; review
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">
              Capture new spending and scan recent lines—updates flow into safe-to-spend and
              insights below.
            </p>
          </header>

          <div className="grid min-h-0 gap-5 lg:grid-cols-2 lg:gap-6">
            <div
              id="add-expense"
              className={`scroll-mt-4 balnced-panel rounded-2xl p-5 transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] sm:p-6 ${addPanelFlash ? "balnced-paid-flash" : ""}`}
            >
              <h3 className="text-base font-semibold tracking-tight text-slate-100">
                Add expense
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Logging expenses improves your daily limit and guidance.
              </p>
              {isPro && suggestedCategory ? (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    Suggested:{" "}
                    <span className="font-medium text-emerald-200/95">{suggestedCategory}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCategory(suggestedCategory)}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Use suggestion
                  </button>
                </p>
              ) : null}
              <form onSubmit={addExpense} className="mt-5 space-y-3">
                <input
                  type="text"
                  placeholder="Expense name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="balnced-input"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="balnced-input"
                  required
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="balnced-input"
                  required
                >
                  <option value="">Select category</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Gas">Gas</option>
                  <option value="Restaurants">Restaurants</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Subscriptions">Subscriptions</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Other">Other</option>
                </select>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-950/40 transition duration-200 ease-out hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-900/35 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  Add expense
                </button>
              </form>

              <div className="mt-4">
                <ExpensePostFeedback
                  feedback={postExpenseFeedback}
                  animationKey={feedbackAnimKey}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 transition-all duration-300 ease-out hover:border-white/[0.14] hover:shadow-[0_12px_40px_-24px_rgba(0,0,0,0.65)] sm:p-6">
              <h3 className="shrink-0 text-base font-semibold tracking-tight text-slate-100">
                Recent
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Same-day context and all-time category totals.
              </p>
              {!loading ? (
                <RecentExpensesList
                  expenses={expenses}
                  categoryTotalsAllTime={categoryTotals}
                  limit={20}
                  onDelete={deleteExpense}
                />
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-500">
                  Loading…
                </div>
              )}
            </div>
          </div>
        </section>

        <section aria-label="Category insights" className="scroll-mt-4 min-h-0">
          <CategoryInsightsPanel loading={loading} insights={categoryInsights} />
        </section>
      </div>
    </DashboardShell>
  );
}
