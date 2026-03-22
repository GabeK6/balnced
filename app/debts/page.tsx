"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import DashboardShell from "@/components/dashboard/shell";
import DashboardPageHero, {
  DASHBOARD_PAGE_SECTION_GAP,
} from "@/components/dashboard/dashboard-page-hero";
import { DashboardPageBreadcrumb } from "@/components/dashboard/dashboard-page-breadcrumb";
import { loadDashboardData, formatMoney } from "@/lib/dashboard-data";
import {
  buildMonthlyDebtInsights,
  computeDebtSnapshot,
  formatAprPercent,
  orderDebtsForPayoffStrategy,
  payoffStrategyLabel,
  sortDebts,
  type Debt,
  type DebtSortKey,
  type DebtType,
} from "@/lib/debt";
import { supabase } from "@/lib/supabase";
import DebtItemCard from "@/components/dashboard/debt-item-card";
import DebtFormModal from "@/components/dashboard/debt-form-modal";
import SectionEmptyState from "@/components/dashboard/section-empty-state";

export default function DebtsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<DebtSortKey>("balance_desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [saving, setSaving] = useState(false);
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      const payday = data.budget?.next_payday;
      const hasPayday = payday != null && String(payday).trim() !== "";
      if (!data.budget || !hasPayday) {
        window.location.href = "/onboarding";
        return;
      }
      setUserId(data.user.id);
      setDebts(data.debts ?? []);
    } catch (e) {
      console.error(e);
      setLoadError("Unable to load debts. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedDebts = useMemo(() => sortDebts(debts, sortBy), [debts, sortBy]);

  const payoffOrderInfo = useMemo(() => {
    if (sortBy === "payoff_snowball") {
      return {
        order: orderDebtsForPayoffStrategy(debts, "snowball"),
        strategyTitle: payoffStrategyLabel("snowball"),
      };
    }
    if (sortBy === "payoff_avalanche") {
      return {
        order: orderDebtsForPayoffStrategy(debts, "avalanche"),
        strategyTitle: payoffStrategyLabel("avalanche"),
      };
    }
    return null;
  }, [debts, sortBy]);

  const snap = useMemo(() => computeDebtSnapshot(debts), [debts]);

  const monthlyInsights = useMemo(
    () => buildMonthlyDebtInsights(debts, snap),
    [debts, snap]
  );

  function openAdd() {
    setFormSubmitError(null);
    setModalMode("add");
    setEditingDebt(null);
    setModalOpen(true);
  }

  function openEdit(d: Debt) {
    setFormSubmitError(null);
    setModalMode("edit");
    setEditingDebt(d);
    setModalOpen(true);
  }

  async function handleDelete(d: Debt) {
    setDeleteError(null);
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Delete “${d.name}”? This cannot be undone.`)
        : true;
    if (!ok) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("debts")
      .delete()
      .eq("id", d.id)
      .eq("user_id", user.id);

    if (error) {
      setDeleteError(error.message);
      return;
    }
    await loadData();
  }

  async function handleFormSubmit(values: {
    name: string;
    debt_type: DebtType;
    balance: number;
    apr: number;
    minimum_payment: number;
    due_day: number | null;
    credit_limit: number | null;
    lender: string | null;
    notes: string | null;
  }) {
    setSaving(true);
    setFormSubmitError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const row = {
      name: values.name,
      debt_type: values.debt_type,
      balance: values.balance,
      apr: values.apr,
      minimum_payment: values.minimum_payment,
      due_day: values.due_day,
      credit_limit: values.credit_limit,
      lender: values.lender,
      notes: values.notes,
    };

    if (modalMode === "add") {
      const { error } = await supabase.from("debts").insert({ ...row, user_id: user.id });
      if (error) {
        setFormSubmitError(error.message);
        setSaving(false);
        return;
      }
    } else if (editingDebt) {
      const { error } = await supabase
        .from("debts")
        .update(row)
        .eq("id", editingDebt.id)
        .eq("user_id", user.id);

      if (error) {
        setFormSubmitError(error.message);
        setSaving(false);
        return;
      }
    }

    await loadData();
    setSaving(false);
    setModalOpen(false);
    setEditingDebt(null);
  }

  if (loading) {
    return (
      <DashboardShell
        title=""
        subtitle=""
        compact
        headerOverride={<DashboardPageBreadcrumb current="Debts" />}
      >
        <div className="balnced-panel rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-emerald-500/20" />
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-700/80" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-700/50" />
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={<DashboardPageBreadcrumb current="Debts" />}
    >
      <div className={`mx-auto max-w-7xl ${DASHBOARD_PAGE_SECTION_GAP}`}>
        <DashboardPageHero
          eyebrow="Debt overview"
          title="Debts"
          subtitle="See balances, APRs, and estimated interest — then keep everything in sync as you pay things down."
          icon={CreditCard}
          accent="violet"
          stats={[
            {
              label: "Total debt",
              value: formatMoney(snap.totalDebt),
              hint: `${debts.length} account${debts.length !== 1 ? "s" : ""}`,
            },
            {
              label: "Weighted APR",
              value: formatAprPercent(snap.weightedAverageApr, 2),
              hint: "Balance-weighted",
            },
            {
              label: "Est. monthly interest",
              value: formatMoney(snap.estimatedMonthlyInterest),
              hint: "Approximate",
            },
          ]}
          toolbar={
            <div className="flex w-full flex-wrap items-end justify-between gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span className="sr-only">Sort debts</span>
                <span className="hidden sm:inline">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as DebtSortKey)}
                  className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/40"
                >
                  <option value="balance_desc">Balance (high → low)</option>
                  <option value="balance_asc">Balance (low → high)</option>
                  <option value="apr_desc">APR (high → low)</option>
                  <option value="apr_asc">APR (low → high)</option>
                  <option value="payoff_snowball">Payoff: snowball order</option>
                  <option value="payoff_avalanche">Payoff: avalanche order</option>
                </select>
              </label>
              <button
                type="button"
                onClick={openAdd}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Add debt
              </button>
            </div>
          }
        />

        {loadError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
            {loadError}
            <button
              type="button"
              onClick={() => void loadData()}
              className="ml-3 font-semibold text-emerald-300 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        ) : null}

        {deleteError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
            {deleteError}
          </div>
        ) : null}

        {monthlyInsights.length > 0 ? (
          <section
            className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-5 sm:p-6"
            aria-label="Planning insights"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Planning insights
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Rule-based hints today — payoff timelines and extra-payment sims will plug into the same
              pipeline.
            </p>
            <ul className="mt-4 space-y-3">
              {monthlyInsights.slice(0, 3).map((ins) => (
                <li
                  key={ins.id}
                  className="rounded-xl border border-white/[0.06] bg-slate-900/30 px-4 py-3"
                >
                  <p className="text-sm font-medium text-slate-200">{ins.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{ins.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Your debts">
          {sortedDebts.length === 0 ? (
            <SectionEmptyState
              title="No debts yet"
              description="Add your first card or loan to see balances, utilization, and interest cost in one place."
              actionLabel="Add debt"
              onAction={openAdd}
            />
          ) : (
            <ul className="space-y-4">
              {sortedDebts.map((d) => {
                let payoffPriority: number | null = null;
                if (payoffOrderInfo != null) {
                  const idx = payoffOrderInfo.order.findIndex((x) => x.id === d.id);
                  payoffPriority = idx >= 0 ? idx + 1 : null;
                }
                return (
                  <li key={d.id}>
                    <DebtItemCard
                      debt={d}
                      onEdit={() => openEdit(d)}
                      onDelete={() => void handleDelete(d)}
                      payoffPriority={payoffPriority}
                      payoffStrategyLabel={payoffOrderInfo?.strategyTitle ?? null}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {userId ? (
          <p className="text-center text-[11px] text-slate-600">
            Estimates are for planning only — not financial advice.
          </p>
        ) : null}
      </div>

      <DebtFormModal
        open={modalOpen}
        mode={modalMode}
        initial={editingDebt}
        saving={saving}
        submitError={formSubmitError}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingDebt(null);
            setFormSubmitError(null);
          }
        }}
        onSubmit={(v) => void handleFormSubmit(v)}
      />
    </DashboardShell>
  );
}
