"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import DashboardShell from "@/components/dashboard/shell";
import DashboardPageHero, {
  DASHBOARD_PAGE_SECTION_GAP,
} from "@/components/dashboard/dashboard-page-hero";
import { DashboardPageBreadcrumb } from "@/components/dashboard/dashboard-page-breadcrumb";
import BillItemCard from "@/components/dashboard/bill-item-card";
import BillsSummarySection from "@/components/dashboard/bills-summary-section";
import RecurringTemplatesList from "@/components/dashboard/recurring-templates-list";
import SectionEmptyState from "@/components/dashboard/section-empty-state";
import {
  loadDashboardData,
  formatBillDuePrimary,
  formatMoney,
  getMonthlyPay,
  Bill,
  Budget,
  RecurringBill,
  generateRecurringBills,
  addDays,
  parseDateOnlyLocal,
  toDateOnly,
} from "@/lib/dashboard-data";
import {
  billIsPaid,
  classifyBillOccurrences,
  daysFromTodayToDueDate,
  estimateMonthlyRecurringTotal,
  formatBillDueTimingPaid,
  formatBillRelativeDue,
  getPaidRecurringBills,
  partitionOverdueByRecency,
  partitionThisWeekNextTwoVsRest,
  partitionUpcomingThisWeekVsLater,
  buildPaidOccurrenceKeySet,
  getOverdueBills,
  hasPaidLedgerOccurrence,
  ledgerDueMatchesOccurrence,
  occurrenceOccurrenceKey,
  normalizeBillDueDate,
  recurringBillIdsMatch,
  sumBillAmounts,
  sumEnrichedOccurrenceAmounts,
  type EnrichedOccurrence,
} from "@/lib/recurring-bill-occurrences";
import { supabase } from "@/lib/supabase";
import { billPaidFields } from "@/lib/bill-paid-fields";
import {
  countConsecutivePaidMonthsStreak,
  describeRecurringSchedule,
  formatNextDuePrediction,
  formatPaidStreakLine,
} from "@/lib/recurring-bill-insights";

/** Shared column shell: equal height, aligned hover. */
const BILL_COLUMN_CLASS =
  "flex h-full min-h-0 max-h-[min(24rem,52vh)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/35 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-300 ease-out motion-reduce:transition-none hover:border-white/[0.14] sm:max-h-[28rem] sm:p-6 sm:hover:-translate-y-0.5 sm:hover:shadow-[0_14px_44px_-20px_rgba(0,0,0,0.65)] motion-reduce:hover:translate-y-0";

const SECTION_EYEBROW =
  "text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500";
const SECTION_DESC = "mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500";

function occurrenceUiKey(occ: EnrichedOccurrence): string {
  return occurrenceOccurrenceKey(occ.recurringBill.id, occ.dueDate);
}

const DEBUG_BILLS_PAID =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function debugBillsPaid(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_BILLS_PAID) return;
  console.debug(`[balnced:bills-paid] ${label}`, payload);
}

/** Verbose sync / classification logs — set sessionStorage balnced_debug_bills_sync = "1" */
function debugBillsSync(label: string, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("balnced_debug_bills_sync") !== "1") return;
  console.debug(`[balnced:bills-sync] ${label}`, payload);
}

/** True when PostgREST/Postgres reports a missing column or stale schema cache for bills paid fields. */
function isSupabaseMissingBillsPaidColumnError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string };
  const code = String(e.code ?? "");
  const msg = `${String(e.message ?? "")} ${String(e.details ?? "")}`.toLowerCase();
  if (code === "PGRST204" || code === "42703") {
    return (
      msg.includes("is_paid") ||
      msg.includes("paid_at") ||
      msg.includes("bills") ||
      msg.includes("schema cache") ||
      msg.includes("column")
    );
  }
  return (
    (msg.includes("column") && msg.includes("does not exist")) ||
    (msg.includes("could not find") && msg.includes("column") && msg.includes("schema cache"))
  );
}

const BILLS_PAID_SCHEMA_HINT =
  "The API could not read or write `is_paid` / `paid_at` on `public.bills` (missing column or stale PostgREST schema cache). Reload the schema in the Supabase dashboard or apply migrations, then retry.";

function isDueInSameCalendarMonth(dueYmd: string, now: Date): boolean {
  const head = normalizeBillDueDate(dueYmd);
  if (!head) return false;
  const d = parseDateOnlyLocal(head);
  if (!d) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Optimistic toggle overrides enrich() until refetch completes. */
function effectiveOccurrenceIsPaid(
  occ: EnrichedOccurrence,
  optimistic: Record<string, boolean>
): boolean {
  const k = occurrenceUiKey(occ);
  if (Object.prototype.hasOwnProperty.call(optimistic, k)) {
    return optimistic[k] === true;
  }
  return occ.isPaid;
}

function isOptimisticPaidRowId(id: string): boolean {
  return id.startsWith("optimistic-paid-");
}

function categoryForLedgerBill(
  bill: Bill,
  templates: RecurringBill[]
): string | null {
  if (!bill.recurring_bill_id) return null;
  const t = templates.find((r) =>
    recurringBillIdsMatch(r.id, bill.recurring_bill_id)
  );
  return t?.category?.trim() || null;
}

/**
 * PostgREST / Supabase RPC often returns a bare number, but some setups return
 * bigint-as-string, one-key objects, or single-element arrays — which used to look
 * like "0 rows" and skip the success path.
 */
function parseRpcAffectedRows(data: unknown): number {
  if (data == null) return 0;
  if (typeof data === "number" && Number.isFinite(data))
    return Math.max(0, Math.trunc(data));
  if (typeof data === "string" && data.trim() !== "") {
    const n = Number(data);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const n = parseRpcAffectedRows(item);
      if (n > 0) return n;
    }
    return 0;
  }
  if (typeof data === "object" && data !== null) {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const n = parseRpcAffectedRows(v);
      if (n > 0) return n;
    }
  }
  const n = Number(data);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  /** Immediate checkbox feedback; cleared after toggle finishes (success or error). */
  const [occurrencePaidOptimistic, setOccurrencePaidOptimistic] = useState<
    Record<string, boolean>
  >({});
  /** Stash occurrence rows marked paid so totals + Paid list update before refetch. */
  const [optimisticPaidOccurrenceMeta, setOptimisticPaidOccurrenceMeta] = useState<
    Record<string, EnrichedOccurrence>
  >({});
  /** Brief checkbox scale animation per occurrence key. */
  const [checkPopKeys, setCheckPopKeys] = useState<Record<string, true>>({});
  /** One-shot highlight on optimistic paid rows landing in Paid. */
  const [paidEnterFlashKeys, setPaidEnterFlashKeys] = useState<Record<string, true>>({});
  const [billActionError, setBillActionError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] =
    useState<RecurringBill["frequency"]>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");

  const paidOccurrenceKeySet = useMemo(
    () => buildPaidOccurrenceKeySet(bills),
    [bills]
  );

  /** Same rules as getOverdueBills / buildPaidOccurrenceKeySet (single source of truth). */
  const ledgerHasPaidOccurrence = useCallback(
    (billsArg: Bill[], occ: EnrichedOccurrence) =>
      hasPaidLedgerOccurrence(
        billsArg,
        occ.recurringBill.id,
        occ.dueDate,
        paidOccurrenceKeySet
      ),
    [paidOccurrenceKeySet]
  );

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setBills(data.bills);
      setRecurringBills(data.recurringBills);
      setBudget(data.budget);
      setLoading(false);
    }
    load();
  }, []);

  /** When mark-paid was clicked — used only for dev stale-sync warnings. */
  const pendingSyncStartedRef = useRef<Record<string, number>>({});

  /**
   * Keep "Syncing to ledger…" until refetched `bills` confirms the write:
   * - mark paid: clear when a matching paid ledger row exists
   * - unmark: clear when no paid ledger row exists for that occurrence
   */
  useEffect(() => {
    const toClear: string[] = [];
    for (const k of Object.keys(occurrencePaidOptimistic)) {
      const occ = optimisticPaidOccurrenceMeta[k];
      if (!occ) continue;
      const pending = occurrencePaidOptimistic[k];
      if (pending === true) {
        if (ledgerHasPaidOccurrence(bills, occ)) toClear.push(k);
      } else if (pending === false) {
        if (!ledgerHasPaidOccurrence(bills, occ)) toClear.push(k);
      }
    }
    if (toClear.length === 0) return;

    for (const k of toClear) {
      delete pendingSyncStartedRef.current[k];
    }

    debugBillsPaid("optimistic → server: pending cleared (ledger matches intent)", {
      clearedKeys: toClear,
      paidLedgerOccurrenceKeys: Array.from(paidOccurrenceKeySet),
    });
    for (const k of toClear) {
      debugBillsSync("effect: cleared pending (ledger matched intent)", {
        occurrenceKey: k,
        reason: "ledgerHasPaidOccurrence matched",
      });
    }

    setOccurrencePaidOptimistic((prev) => {
      const n = { ...prev };
      for (const k of toClear) delete n[k];
      return n;
    });
    setOptimisticPaidOccurrenceMeta((prev) => {
      const n = { ...prev };
      for (const k of toClear) delete n[k];
      return n;
    });
  }, [bills, occurrencePaidOptimistic, optimisticPaidOccurrenceMeta, ledgerHasPaidOccurrence]);

  useEffect(() => {
    if (!DEBUG_BILLS_PAID) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      for (const k of Object.keys(occurrencePaidOptimistic)) {
        if (occurrencePaidOptimistic[k] !== true) continue;
        const occ = optimisticPaidOccurrenceMeta[k];
        if (!occ) continue;
        if (ledgerHasPaidOccurrence(bills, occ)) continue;
        const started = pendingSyncStartedRef.current[k];
        if (started && now - started > 12000) {
          console.warn("[balnced:bills-paid] pending mark-paid: no ledger row after 12s (mismatch?)", {
            occurrenceKey: k,
            wantDue: normalizeBillDueDate(occ.dueDate),
            recurringBillId: occ.recurringBill.id,
            paidLedgerOccurrenceKeys: Array.from(paidOccurrenceKeySet),
          });
        }
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [bills, occurrencePaidOptimistic, optimisticPaidOccurrenceMeta, ledgerHasPaidOccurrence]);

  const billsSnapshot = useMemo(() => {
    const now = new Date();
    const classified = classifyBillOccurrences(recurringBills, bills, null, now);
    const monthlyRecurringTotal = estimateMonthlyRecurringTotal(recurringBills);

    const overdueOccurrences = classified.overdueUnpaid.filter(
      (o) => !effectiveOccurrenceIsPaid(o, occurrencePaidOptimistic)
    );
    const upcomingOccurrences = classified.upcomingThisMonthUnpaid.filter(
      (o) => !effectiveOccurrenceIsPaid(o, occurrencePaidOptimistic)
    );

    const overdueTotal = sumEnrichedOccurrenceAmounts(overdueOccurrences);
    const upcomingThisMonthTotal = sumEnrichedOccurrenceAmounts(upcomingOccurrences);

    let paidThisMonthTotal = sumBillAmounts(classified.paidThisMonth);
    let paidThisMonthCount = classified.paidThisMonth.length;

    for (const [k, occ] of Object.entries(optimisticPaidOccurrenceMeta)) {
      if (occurrencePaidOptimistic[k] !== true) continue;
      if (!isDueInSameCalendarMonth(occ.dueDate, now)) continue;
      if (ledgerHasPaidOccurrence(bills, occ)) continue;
      paidThisMonthTotal += Number(occ.recurringBill.amount) || 0;
      paidThisMonthCount += 1;
    }

    const overdueCount = overdueOccurrences.length;
    const upcomingCount = upcomingOccurrences.length;

    let overdueInsight: string | null = null;
    if (overdueCount === 1) overdueInsight = "You have 1 overdue bill.";
    else if (overdueCount > 1)
      overdueInsight = `You have ${overdueCount} overdue bills.`;

    let nextDueInsight: string | null = null;
    const upcoming = upcomingOccurrences;
    if (upcoming.length > 0) {
      const first = upcoming[0];
      const days = daysFromTodayToDueDate(first.dueDate, now);
      const name = first.recurringBill.name;
      if (days === 0) nextDueInsight = `Next bill due today (${name}).`;
      else if (days === 1) nextDueInsight = `Next bill due tomorrow (${name}).`;
      else nextDueInsight = `Next bill due in ${days} days (${name}).`;
    } else if (recurringBills.length === 0) {
      nextDueInsight = "Add recurring templates to see due dates and totals.";
    } else if (overdueCount === 0) {
      nextDueInsight = "No upcoming bills left this calendar month.";
    }

    if (
      DEBUG_BILLS_PAID &&
      typeof window !== "undefined" &&
      sessionStorage.getItem("balnced_debug_bills") === "1"
    ) {
      const overdueKeys = overdueOccurrences.map((o) => occurrenceUiKey(o));
      const upcomingKeys = upcomingOccurrences.map((o) => occurrenceUiKey(o));
      const paidKeys = classified.paidThisMonth.map((b) =>
        occurrenceOccurrenceKey(String(b.recurring_bill_id ?? ""), b.due_date)
      );
      debugBillsPaid("derive lists (after optimistic filter)", {
        overdueKeys,
        upcomingKeys,
        paidThisMonthLedgerKeys: paidKeys,
        paidLedgerOccurrenceKeysAll: Array.from(paidOccurrenceKeySet),
        optimisticKeys: Object.keys(occurrencePaidOptimistic),
      });
    }

    if (typeof window !== "undefined" && sessionStorage.getItem("balnced_debug_bills_sync") === "1") {
      debugBillsSync("snapshot: derive lists", {
        paidOccurrenceKeys: [...paidOccurrenceKeySet],
        classifiedOverdueUnpaid: classified.overdueUnpaid.map((o) => ({
          key: occurrenceUiKey(o),
          isPaidField: o.isPaid,
        })),
        overdueDisplayed: overdueOccurrences.map((o) => occurrenceUiKey(o)),
        upcomingDisplayed: upcomingOccurrences.map((o) => occurrenceUiKey(o)),
        optimisticPending: { ...occurrencePaidOptimistic },
      });
    }

    return {
      overdueOccurrences,
      upcomingOccurrences,
      monthlyRecurringTotal,
      overdueTotal,
      upcomingThisMonthTotal,
      paidThisMonthTotal,
      overdueCount,
      upcomingCount,
      paidThisMonthCount,
      overdueInsight,
      nextDueInsight,
    };
  }, [
    recurringBills,
    bills,
    occurrencePaidOptimistic,
    optimisticPaidOccurrenceMeta,
    ledgerHasPaidOccurrence,
  ]);

  const { overdueOccurrences, upcomingOccurrences } = billsSnapshot;

  const overduePartitioned = useMemo(
    () => partitionOverdueByRecency(overdueOccurrences, new Date()),
    [overdueOccurrences]
  );

  const upcomingPartitioned = useMemo(() => {
    const now = new Date();
    const { thisWeek, laterThisMonth } = partitionUpcomingThisWeekVsLater(
      upcomingOccurrences,
      now
    );
    const { nextTwoDays, restOfWeek } = partitionThisWeekNextTwoVsRest(thisWeek, now);
    return { nextTwoDays, restOfWeek, laterThisMonth };
  }, [upcomingOccurrences]);

  const monthlyTakeHome = useMemo(() => getMonthlyPay(budget), [budget]);

  const billsHeroStats = useMemo(() => {
    const monthly = billsSnapshot.monthlyRecurringTotal;
    const income = monthlyTakeHome;
    const pct = income > 0 ? Math.round((monthly / income) * 100) : null;
    const paid = billsSnapshot.paidThisMonthTotal;
    const remaining = billsSnapshot.upcomingThisMonthTotal + billsSnapshot.overdueTotal;
    return [
      {
        label: "Monthly bills",
        value: loading ? "…" : formatMoney(monthly),
        hint: "From recurring templates",
      },
      {
        label: "Bill pressure",
        value: loading ? "…" : pct != null ? `${pct}%` : "—",
        hint:
          income > 0
            ? `of ${formatMoney(income)} take-home`
            : "Set income on Overview",
      },
      {
        label: "Paid vs · due",
        value: loading ? "…" : formatMoney(paid),
        hint: loading ? undefined : `${formatMoney(remaining)} still due (unpaid)`,
      },
    ];
  }, [billsSnapshot, monthlyTakeHome, loading]);

  const paidBills = useMemo(() => getPaidRecurringBills(bills), [bills]);

  const recurringInsightById = useMemo(() => {
    const now = new Date();
    const m = new Map<
      string,
      { schedule: string; nextDue: string | null; streakLine: string | null }
    >();
    for (const rb of recurringBills) {
      const streak = countConsecutivePaidMonthsStreak(rb, bills);
      m.set(rb.id, {
        schedule: describeRecurringSchedule(rb),
        nextDue: formatNextDuePrediction(rb, now),
        streakLine: formatPaidStreakLine(streak),
      });
    }
    return m;
  }, [recurringBills, bills]);

  const paidBillsMerged = useMemo(() => {
    const now = new Date();
    const synthetic: Bill[] = [];
    for (const [k, occ] of Object.entries(optimisticPaidOccurrenceMeta)) {
      if (occurrencePaidOptimistic[k] !== true) continue;
      if (!isDueInSameCalendarMonth(occ.dueDate, now)) continue;
      if (ledgerHasPaidOccurrence(bills, occ)) continue;
      synthetic.push({
        id: `optimistic-paid-${k}`,
        name: occ.recurringBill.name,
        amount: Number(occ.recurringBill.amount),
        due_date: occ.dueDate,
        recurring_bill_id: occ.recurringBill.id,
        is_recurring: true,
        ...billPaidFields(true),
      });
    }
    return [...synthetic, ...paidBills];
  }, [
    bills,
    paidBills,
    optimisticPaidOccurrenceMeta,
    occurrencePaidOptimistic,
    ledgerHasPaidOccurrence,
  ]);

  const refetchBills = useCallback(async (): Promise<Bill[] | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("due_date", { ascending: true });

    if (error) {
      console.error(error);
      alert(error.message || "Could not refresh bills.");
      return null;
    }
    const list = (data || []) as Bill[];
    setBills(list);
    return list;
  }, []);

  const clearOccurrenceSyncState = useCallback((key: string) => {
    setOccurrencePaidOptimistic((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const { [key]: _r, ...rest } = prev;
      return rest;
    });
    setOptimisticPaidOccurrenceMeta((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const { [key]: _r, ...rest } = prev;
      return rest;
    });
    delete pendingSyncStartedRef.current[key];
    debugBillsSync("syncing state cleared (optimistic removed)", { occurrenceKey: key });
  }, []);

  const setOccurrencePaid = useCallback(
    async (occ: EnrichedOccurrence, paid: boolean): Promise<boolean> => {
      setBillActionError(null);

      const occKey = occurrenceUiKey(occ);
      debugBillsPaid("mark paid: start", {
        occurrenceKey: occKey,
        recurringBillId: occ.recurringBill.id,
        dueDateRaw: occ.dueDate,
        paid,
        billId: occ.billId ?? null,
      });

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) {
        const msg = authErr.message || "Auth error.";
        setBillActionError(msg);
        alert(msg);
        return false;
      }
      if (!user) {
        const msg = "You need to be signed in to update bills.";
        setBillActionError(msg);
        alert(msg);
        return false;
      }

      /** Create missing `bills` rows for current window (see generateRecurringBills lookback). */
      await generateRecurringBills(user.id, recurringBills);

      const want = normalizeBillDueDate(occ.dueDate);
      if (!want) {
        const msg = "Could not determine this bill's due date.";
        setBillActionError(msg);
        alert(msg);
        return false;
      }

      let lastConfirmError: unknown = null;

      const ledgerRowsMatchOccurrence = (b: Bill) =>
        recurringBillIdsMatch(b.recurring_bill_id, occ.recurringBill.id) &&
        ledgerDueMatchesOccurrence(b.due_date, want) &&
        !b.archived;

      const verifyRowsPaidState = (rows: Bill[]): boolean => {
        if (!rows.length) return !paid;
        if (paid) return rows.some((r) => billIsPaid(r));
        return rows.every((r) => !billIsPaid(r));
      };

      const verifyLedgerReflectsPaid = (list: Bill[]): boolean => {
        const rows = list.filter(ledgerRowsMatchOccurrence);
        return verifyRowsPaidState(rows);
      };

      /** Every ledger row for this template + due date (duplicates can exist from codegen + manual saves). */
      const findLedgerIdsForOccurrence = async (): Promise<string[]> => {
        const { data: candidates, error: qErr } = await supabase
          .from("bills")
          .select("id, due_date, recurring_bill_id")
          .eq("user_id", user.id)
          .eq("archived", false)
          .not("recurring_bill_id", "is", null);
        if (qErr) {
          console.error(qErr);
          const msg = qErr.message || "Could not look up bill.";
          setBillActionError(msg);
          alert(msg);
          return [];
        }
        const ids =
          candidates
            ?.filter(
              (r) =>
                recurringBillIdsMatch(r.recurring_bill_id, occ.recurringBill.id) &&
                ledgerDueMatchesOccurrence(r.due_date, want)
            )
            .map((r) => String(r.id)) ?? [];
        const idSet = new Set(ids);
        if (occ.billId) idSet.add(String(occ.billId));
        return [...idSet];
      };

      /**
       * Do not chain `.select()` after update: common RLS policies allow UPDATE but not
       * RETURNING rows, so PostgREST returns an empty array with no error and we'd bail incorrectly.
       */
      const updatePaidByIds = async (billIds: string[]): Promise<boolean> => {
        if (!billIds.length) return false;
        const { error } = await supabase
          .from("bills")
          .update(billPaidFields(paid))
          .in("id", billIds)
          .eq("user_id", user.id);
        if (error) {
          console.error(error);
          const msg = isSupabaseMissingBillsPaidColumnError(error)
            ? BILLS_PAID_SCHEMA_HINT
            : error.message || "Could not update bill.";
          setBillActionError(msg);
          alert(msg);
          return false;
        }
        return true;
      };

      /**
       * Prefer a half-open calendar-day window so `date` / `timestamptz` rows match.
       * Plain `.in("due_date", ["2026-03-01", ...])` often updates 0 rows (no error).
       */
      const updatePaidByCalendarDayWindow = async (): Promise<boolean> => {
        const start = parseDateOnlyLocal(want);
        if (!start) return false;
        const dayAfter = toDateOnly(addDays(start, 1));
        const { error } = await supabase
          .from("bills")
          .update(billPaidFields(paid))
          .eq("user_id", user.id)
          .eq("recurring_bill_id", occ.recurringBill.id)
          .eq("archived", false)
          .gte("due_date", want)
          .lt("due_date", dayAfter);
        if (error) {
          console.error(error);
          const msg = isSupabaseMissingBillsPaidColumnError(error)
            ? BILLS_PAID_SCHEMA_HINT
            : error.message || "Could not update bill.";
          setBillActionError(msg);
          alert(msg);
          return false;
        }
        return true;
      };

      /** Fallback for exotic due_date serializations. */
      const updatePaidByDueVariants = async (): Promise<boolean> => {
        const dueVariants = Array.from(
          new Set([
            want,
            `${want}T00:00:00`,
            `${want}T00:00:00Z`,
            `${want}T00:00:00.000Z`,
            `${want}T12:00:00.000Z`,
          ])
        );
        const { error } = await supabase
          .from("bills")
          .update(billPaidFields(paid))
          .eq("user_id", user.id)
          .eq("recurring_bill_id", occ.recurringBill.id)
          .eq("archived", false)
          .in("due_date", dueVariants);
        if (error) {
          console.error(error);
          const msg = isSupabaseMissingBillsPaidColumnError(error)
            ? BILLS_PAID_SCHEMA_HINT
            : error.message || "Could not update bill.";
          setBillActionError(msg);
          alert(msg);
          return false;
        }
        return true;
      };

      const tryFinish = async (): Promise<boolean> => {
        const list = await refetchBills();
        if (!list) return false;
        if (verifyLedgerReflectsPaid(list)) {
          debugBillsPaid("tryFinish after refetch", {
            occurrenceKey: occKey,
            want,
            ok: true,
            path: "full_ledger",
            matching: list
              .filter(ledgerRowsMatchOccurrence)
              .map((b) => ({
                id: b.id,
                due_date: b.due_date,
                is_paid: b.is_paid,
                paid_at: b.paid_at,
              })),
          });
          return true;
        }

        const matching = list.filter(ledgerRowsMatchOccurrence);
        debugBillsPaid("tryFinish after refetch", {
          occurrenceKey: occKey,
          want,
          ok: false,
          path: "full_ledger",
          matching: matching.map((b) => ({
            id: b.id,
            due_date: b.due_date,
            is_paid: b.is_paid,
            paid_at: b.paid_at,
          })),
        });

        const start = parseDateOnlyLocal(want);
        if (!start) return false;
        const dayAfter = toDateOnly(addDays(start, 1));
        const { data: confirmData, error: confirmErr } = await supabase
          .from("bills")
          .select("id, is_paid, paid_at, due_date, recurring_bill_id, archived")
          .eq("user_id", user.id)
          .eq("archived", false)
          .eq("recurring_bill_id", occ.recurringBill.id)
          .gte("due_date", want)
          .lt("due_date", dayAfter);

        const confirmRows = (confirmData ?? []) as Bill[];
        debugBillsPaid("confirm query (calendar window, matches RPC)", {
          occurrenceKey: occKey,
          filters: {
            user_id: user.id,
            recurring_bill_id: occ.recurringBill.id,
            due_gte: want,
            due_lt: dayAfter,
          },
          rawError: confirmErr ?? null,
          rows: confirmRows.map((b) => ({
            id: b.id,
            due_date: b.due_date,
            is_paid: b.is_paid,
            paid_at: b.paid_at,
          })),
        });

        if (confirmErr) {
          lastConfirmError = confirmErr;
          console.error("[balnced:bills-paid] confirm select failed", confirmErr);
          return false;
        }

        if (verifyRowsPaidState(confirmRows)) {
          debugBillsPaid("tryFinish: paid state confirmed via narrow query", {
            occurrenceKey: occKey,
            ok: true,
            path: "confirm_select",
          });
          return true;
        }

        return false;
      };

      /** When strict verify fails, accept server row if it clearly matches this occurrence. */
      const refetchMatchesOccurrence = async (): Promise<boolean> => {
        const list = await refetchBills();
        if (!list?.length) return false;
        return list.some((b) => {
          if (!ledgerRowsMatchOccurrence(b)) return false;
          return paid ? billIsPaid(b) : !billIsPaid(b);
        });
      };

      /** DB-side update (runs as owner); avoids RLS/PostgREST edge cases. Requires migration SQL. */
      const rpcUpdateOccurrence = async (): Promise<{
        ok: boolean;
        rowCount: number;
        missing: boolean;
        errMsg?: string;
      }> => {
        const { data, error } = await supabase.rpc("set_bill_occurrence_paid", {
          p_recurring_bill_id: String(occ.recurringBill.id),
          p_due_date: want,
          p_paid: paid,
        });
        if (error) {
          const msg = String(error.message ?? "").toLowerCase();
          const missing =
            msg.includes("could not find") ||
            msg.includes("does not exist") ||
            msg.includes("undefined function") ||
            msg.includes("schema cache") ||
            error.code === "42883" ||
            error.code === "PGRST202";
          return { ok: false, rowCount: 0, missing, errMsg: error.message };
        }
        const rowCount = parseRpcAffectedRows(data);
        return { ok: true, rowCount, missing: false };
      };

      const rpcResult = await rpcUpdateOccurrence();
      debugBillsPaid("Supabase RPC set_bill_occurrence_paid result", {
        occurrenceKey: occKey,
        ok: rpcResult.ok,
        rowCount: rpcResult.rowCount,
        missing: rpcResult.missing,
        errMsg: rpcResult.errMsg ?? null,
        rpcRawHint: "see Network tab for full RPC payload",
      });

      if (rpcResult.ok && rpcResult.rowCount > 0) {
        if (await tryFinish()) return true;
        await new Promise((r) => setTimeout(r, 200));
        if (await tryFinish()) return true;
        /**
         * RPC already updated `n` matching rows in Postgres. Falling through to insert/window
         * updates created duplicate rows and false "migration" errors when client-side verify
         * lagged (payload shape, duplicate rows, or omitted `is_paid` in JSON).
         */
        debugBillsPaid(
          "RPC set_bill_occurrence_paid: trusting server after verify mismatch",
          {
            occurrenceKey: occKey,
            rowCount: rpcResult.rowCount,
            want,
            lastConfirmError: lastConfirmError ?? null,
          }
        );
        console.warn(
          "[balnced:bills-paid] set_bill_occurrence_paid: DB reports updated rows; accepting success after refetch",
          { occurrenceKey: occKey, rowCount: rpcResult.rowCount }
        );
        await refetchBills();
        return true;
      }
      if (!rpcResult.ok && !rpcResult.missing && rpcResult.errMsg) {
        console.error("set_bill_occurrence_paid:", rpcResult.errMsg);
      }

      const ledgerIds = await findLedgerIdsForOccurrence();
      if (ledgerIds.length > 0) {
        await updatePaidByIds(ledgerIds);
        if (await tryFinish()) return true;
      }

      await updatePaidByCalendarDayWindow();
      if (await tryFinish()) return true;

      await updatePaidByDueVariants();
      if (await tryFinish()) return true;

      const insertPayload = {
        user_id: user.id,
        name: occ.recurringBill.name,
        amount: Number(occ.recurringBill.amount),
        due_date: want,
        archived: false,
        recurring_bill_id: occ.recurringBill.id,
        is_recurring: true,
        ...billPaidFields(paid),
      };
      debugBillsPaid("ledger insert fallback payload", {
        occurrenceKey: occKey,
        insertPayload,
      });
      const { error: insertErr } = await supabase.from("bills").insert(insertPayload);

      if (insertErr) {
        lastConfirmError = insertErr;
        console.error("[balnced:bills-paid] insert fallback raw error", insertErr);
        await updatePaidByCalendarDayWindow();
        await updatePaidByDueVariants();
        if (await tryFinish()) return true;
        if (ledgerIds.length > 0) {
          await updatePaidByIds(ledgerIds);
          if (await tryFinish()) return true;
        }
        const im = isSupabaseMissingBillsPaidColumnError(insertErr)
          ? BILLS_PAID_SCHEMA_HINT
          : insertErr.message || "Could not save bill.";
        setBillActionError(im);
        alert(im);
        return false;
      }

      if (await tryFinish()) return true;
      if (await refetchMatchesOccurrence()) return true;

      const list = await refetchBills();
      debugBillsPaid("mark paid: FAILED — final ledger snapshot", {
        occurrenceKey: occKey,
        want,
        lastConfirmError: lastConfirmError ?? null,
        rowsForTemplate:
          list?.filter((b) => recurringBillIdsMatch(b.recurring_bill_id, occ.recurringBill.id)) ?? [],
        matchingOccurrenceRows:
          list?.filter(ledgerRowsMatchOccurrence).map((b) => ({
            id: b.id,
            due_date: b.due_date,
            is_paid: b.is_paid,
            paid_at: b.paid_at,
          })) ?? [],
      });

      let msg: string;
      if (lastConfirmError && isSupabaseMissingBillsPaidColumnError(lastConfirmError)) {
        msg = BILLS_PAID_SCHEMA_HINT;
      } else if (lastConfirmError) {
        const e = lastConfirmError as { message?: string };
        msg = `Could not confirm the bill was saved: ${e.message ?? String(lastConfirmError)}`;
      } else {
        msg =
          "Could not confirm the bill was saved (paid state still does not match after updates). Open DevTools → Console and filter for [balnced:bills-paid].";
      }
      setBillActionError(msg);
      alert(msg);
      return false;
    },
    [refetchBills, recurringBills]
  );

  async function addRecurringBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const payload = {
      user_id: user.id,
      name,
      amount: Number(amount),
      category: category || null,
      frequency,
      day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
      day_of_week:
        frequency === "weekly" || frequency === "biweekly"
          ? Number(dayOfWeek)
          : null,
      active: true,
    };

    const { data, error } = await supabase
      .from("recurring_bills")
      .insert(payload)
      .select("*")
      .single();

    if (error) return alert("Could not save recurring bill.");

    const updated = [data as RecurringBill, ...recurringBills];
    setRecurringBills(updated);
    await generateRecurringBills(user.id, updated);

    const { data: billsData } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("due_date", { ascending: true });

    setBills((billsData || []) as Bill[]);
    setName("");
    setAmount("");
    setCategory("");
    setFrequency("monthly");
    setDayOfMonth("");
    setDayOfWeek("1");
  }

  async function deleteRecurringBill(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return alert("You need to be signed in.");
    const { error } = await supabase
      .from("recurring_bills")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return alert("Could not delete recurring bill.");
    setRecurringBills((prev) => prev.filter((rb) => rb.id !== id));
    setBills((prev) => prev.filter((b) => b.recurring_bill_id !== id));
  }

  async function deleteBill(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return alert("You need to be signed in.");
    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return alert("Could not delete bill.");
    setBills((prev) => prev.filter((bill) => bill.id !== id));
  }

  async function toggleBillPaid(id: string, currentValue: boolean) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("You need to be signed in to update bills.");
      return;
    }

    const nextPaid = !currentValue;
    const paidPayload = billPaidFields(nextPaid);
    setBills((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...paidPayload } : b))
    );

    const { error } = await supabase
      .from("bills")
      .update(paidPayload)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      alert(error.message || "Could not update bill.");
      void refetchBills();
      return;
    }

    await refetchBills();
  }

  function renderOccurrenceRow(occ: EnrichedOccurrence, overdue: boolean) {
    const ok = occurrenceUiKey(occ);
    const optimistic = occurrencePaidOptimistic[ok];
    const checked = optimistic !== undefined ? optimistic : occ.isPaid;
    const relativeHint = formatBillRelativeDue(occ.dueDate);
    const deltaDays = daysFromTodayToDueDate(occ.dueDate);
    const status = overdue ? "overdue" : "upcoming";

    const checkbox = (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? "Mark as unpaid" : "Mark as paid"}
        onClick={() => {
          setBillActionError(null);
          const nextPaid = !checked;
          setOccurrencePaidOptimistic((prev) => ({ ...prev, [ok]: nextPaid }));
          if (nextPaid) {
            pendingSyncStartedRef.current[ok] = Date.now();
            setOptimisticPaidOccurrenceMeta((prev) => ({ ...prev, [ok]: occ }));
            setCheckPopKeys((p) => ({ ...p, [ok]: true }));
            setPaidEnterFlashKeys((p) => ({ ...p, [ok]: true }));
            window.setTimeout(() => {
              setCheckPopKeys((p) => {
                const n = { ...p };
                delete n[ok];
                return n;
              });
            }, 380);
            window.setTimeout(() => {
              setPaidEnterFlashKeys((p) => {
                const n = { ...p };
                delete n[ok];
                return n;
              });
            }, 720);
          } else {
            setOptimisticPaidOccurrenceMeta((prev) => ({ ...prev, [ok]: occ }));
          }

          const revertOccurrenceOptimistic = () => {
            setOccurrencePaidOptimistic((prev) => {
              const { [ok]: _r, ...rest } = prev;
              return rest;
            });
            setOptimisticPaidOccurrenceMeta((prev) => {
              const { [ok]: _r, ...rest } = prev;
              return rest;
            });
            delete pendingSyncStartedRef.current[ok];
          };

          void (async () => {
            try {
              debugBillsPaid("ledger write: start", {
                occurrenceKey: ok,
                nextPaid,
                recurringBillId: occ.recurringBill.id,
                dueNormalized: normalizeBillDueDate(occ.dueDate),
              });
              const okSave = await setOccurrencePaid(occ, nextPaid);
              if (!okSave) {
                const msg =
                  "Could not mark this bill paid. See the red message above or open DevTools (F12) → Console.";
                setBillActionError((prev) => prev ?? msg);
                console.warn("setOccurrencePaid returned false", {
                  recurringId: occ.recurringBill.id,
                  due: normalizeBillDueDate(occ.dueDate),
                });
                revertOccurrenceOptimistic();
                debugBillsPaid("ledger write: FAILED — optimistic reverted", { occurrenceKey: ok });
              } else {
                const fresh = await refetchBills();
                clearOccurrenceSyncState(ok);
                debugBillsPaid("ledger write: success — optimistic cleared after refetch", {
                  occurrenceKey: ok,
                  nextPaid,
                });
                debugBillsSync("post-write: refetched bills + cleared optimistic", {
                  occurrenceKey: ok,
                  recurringBillId: occ.recurringBill.id,
                  dueNormalized: normalizeBillDueDate(occ.dueDate),
                  billRowCount: fresh?.length ?? 0,
                  paidOccurrenceKeys: Array.from(
                    buildPaidOccurrenceKeySet((fresh ?? []) as Bill[])
                  ),
                  hasPaidNow: hasPaidLedgerOccurrence(
                    (fresh ?? []) as Bill[],
                    occ.recurringBill.id,
                    occ.dueDate
                  ),
                  overdueAfter: getOverdueBills(
                    recurringBills,
                    (fresh ?? []) as Bill[],
                    new Date()
                  ).map((o) => occurrenceUiKey(o)),
                });
              }
            } catch (err) {
              console.error(err);
              const msg =
                err instanceof Error ? err.message : String(err ?? "Could not update bill.");
              setBillActionError(msg);
              alert(msg);
              revertOccurrenceOptimistic();
              debugBillsPaid("ledger write: ERROR — optimistic reverted", {
                occurrenceKey: ok,
                err: String(err),
              });
            }
          })();
        }}
        className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-95 motion-reduce:active:scale-100 ${
          checkPopKeys[ok] ? "balnced-check-pop" : ""
        } ${
          checked
            ? "border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-900/40"
            : "cursor-pointer border-slate-300 bg-transparent hover:border-slate-400 dark:border-slate-500 dark:hover:border-slate-400"
        }`}
      >
        {checked ? (
          <span className="motion-safe:drop-shadow-sm" aria-hidden>
            ✓
          </span>
        ) : null}
      </button>
    );

    return (
      <BillItemCard
        key={`${occ.recurringBill.id}-${occ.dueDate}`}
        status={status}
        name={occ.recurringBill.name}
        category={occ.recurringBill.category}
        dueDateDisplay={formatBillDuePrimary(occ.dueDate)}
        relativeHint={relativeHint}
        deltaDays={deltaDays}
        amountDisplay={formatMoney(Number(occ.recurringBill.amount))}
        leading={checkbox}
        trailing={
          <>
            {occ.billId ? (
              <button
                type="button"
                onClick={() => deleteBill(occ.billId!)}
                className="rounded-lg bg-rose-100 px-2 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              >
                Delete
              </button>
            ) : (
              <span className="text-xs font-medium text-slate-500">Planned</span>
            )}
          </>
        }
      />
    );
  }

  return (
    <DashboardShell
      title=""
      subtitle=""
      compact
      headerOverride={<DashboardPageBreadcrumb current="Bills" />}
    >
      <div className={`mx-auto w-full max-w-7xl ${DASHBOARD_PAGE_SECTION_GAP}`}>
        <DashboardPageHero
          eyebrow="Cash flow"
          title="Bills"
          subtitle="Review the summary, work through this month's bills, then manage templates and add new ones."
          icon={CalendarDays}
          accent="amber"
          stats={billsHeroStats}
        />

        {billActionError ? (
          <div
            className="mb-4 rounded-xl border border-rose-300/80 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-100"
            role="alert"
          >
            <p className="font-semibold">Bill update failed</p>
            <p className="mt-1 whitespace-pre-wrap">{billActionError}</p>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-rose-800 underline hover:no-underline dark:text-rose-200"
              onClick={() => setBillActionError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <BillsSummarySection
          loading={loading}
          suppressIntro
          monthlyTakeHome={monthlyTakeHome}
          monthlyRecurringTotal={billsSnapshot.monthlyRecurringTotal}
          overdueTotal={billsSnapshot.overdueTotal}
          overdueCount={billsSnapshot.overdueCount}
          upcomingThisMonthTotal={billsSnapshot.upcomingThisMonthTotal}
          upcomingCount={billsSnapshot.upcomingCount}
          paidThisMonthTotal={billsSnapshot.paidThisMonthTotal}
          paidThisMonthCount={billsSnapshot.paidThisMonthCount}
          overdueInsight={billsSnapshot.overdueInsight}
          nextDueInsight={billsSnapshot.nextDueInsight}
        />

          <section aria-label="Bills this month" className="space-y-4 lg:space-y-5">
            <header>
              <p className={SECTION_EYEBROW}>Bills</p>
              <p className={SECTION_DESC}>
                Overdue, upcoming, and paid—same data as your summary, organized for action.
              </p>
            </header>
            <div className="grid min-h-0 items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
              <div className={BILL_COLUMN_CLASS}>
                <h2 className="shrink-0 text-base font-semibold tracking-tight text-slate-100">
                  Overdue
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  Most urgent first (oldest due date). Grouped by how long they&apos;ve been past
                  due.
                </p>
                <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  {overduePartitioned.recent.length > 0 ? (
                    <div className="space-y-2.5">
                      {overduePartitioned.older.length > 0 ? (
                        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          1–7 days past due
                        </h3>
                      ) : null}
                      <div className="space-y-2.5">
                        {overduePartitioned.recent.map((occ) =>
                          renderOccurrenceRow(occ, true)
                        )}
                      </div>
                    </div>
                  ) : null}
                  {overduePartitioned.older.length > 0 ? (
                    <div className="space-y-2.5">
                      {overduePartitioned.recent.length > 0 ? (
                        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          8+ days past due
                        </h3>
                      ) : null}
                      <div className="space-y-2.5">
                        {overduePartitioned.older.map((occ) =>
                          renderOccurrenceRow(occ, true)
                        )}
                      </div>
                    </div>
                  ) : null}
                  {!loading && overdueOccurrences.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nothing overdue.
                    </p>
                  )}
                </div>
              </div>

              <div className={BILL_COLUMN_CLASS}>
                <h2 className="shrink-0 text-base font-semibold tracking-tight text-slate-100">
                  Upcoming (this month)
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  Soonest due first. Today &amp; tomorrow, then the rest of this week (7-day window),
                  then later in the month.
                </p>
                <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                  {upcomingPartitioned.nextTwoDays.length > 0 ? (
                    <div className="space-y-2.5">
                      {upcomingPartitioned.restOfWeek.length > 0 ||
                      upcomingPartitioned.laterThisMonth.length > 0 ? (
                        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          Next 2 days
                          <span className="ml-1.5 font-normal normal-case text-slate-600">
                            (today &amp; tomorrow)
                          </span>
                        </h3>
                      ) : null}
                      <div className="space-y-2.5">
                        {upcomingPartitioned.nextTwoDays.map((occ) =>
                          renderOccurrenceRow(occ, false)
                        )}
                      </div>
                    </div>
                  ) : null}

                  {upcomingPartitioned.restOfWeek.length > 0 ? (
                    <div className="space-y-2.5">
                      {upcomingPartitioned.nextTwoDays.length > 0 ||
                      upcomingPartitioned.laterThisMonth.length > 0 ? (
                        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          Rest of this week
                          <span className="ml-1.5 font-normal normal-case text-slate-600">
                            (next 7 days)
                          </span>
                        </h3>
                      ) : null}
                      <div className="space-y-2.5">
                        {upcomingPartitioned.restOfWeek.map((occ) =>
                          renderOccurrenceRow(occ, false)
                        )}
                      </div>
                    </div>
                  ) : null}

                  {upcomingPartitioned.laterThisMonth.length > 0 ? (
                    <div className="space-y-2.5">
                      {upcomingPartitioned.nextTwoDays.length > 0 ||
                      upcomingPartitioned.restOfWeek.length > 0 ? (
                        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          Later this month
                        </h3>
                      ) : null}
                      <div className="space-y-2.5">
                        {upcomingPartitioned.laterThisMonth.map((occ) =>
                          renderOccurrenceRow(occ, false)
                        )}
                      </div>
                    </div>
                  ) : null}

                  {!loading && upcomingOccurrences.length === 0 ? (
                    <SectionEmptyState
                      title="No bills due this month"
                      description="Add recurring templates to forecast rent, utilities, and subs."
                      example="e.g. Streaming — $15 on the 12th"
                      actionLabel="Add bill template"
                      actionHref="#add-bill-template"
                    />
                  ) : null}
                </div>
              </div>

              <div className={BILL_COLUMN_CLASS}>
                <h2 className="shrink-0 text-base font-semibold tracking-tight text-slate-100">
                  Paid
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  Marked paid in your ledger.
                </p>
                <div className="mt-4 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {paidBillsMerged.map((bill) => {
                const optimisticRow = isOptimisticPaidRowId(bill.id);
                const flashKey = optimisticRow
                  ? bill.id.slice("optimistic-paid-".length)
                  : "";

                const paidLeading = optimisticRow ? (
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-emerald-500 bg-emerald-600 text-[10px] font-bold text-white balnced-check-pop"
                    title="Saving to ledger"
                    aria-hidden
                  >
                    ✓
                  </div>
                ) : (
                  <input
                    type="checkbox"
                    checked={!!bill.is_paid}
                    onChange={() => {
                      void toggleBillPaid(bill.id, !!bill.is_paid);
                    }}
                    className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-emerald-500 transition-transform duration-150 focus:ring-emerald-500 active:scale-95 dark:border-slate-500 motion-reduce:active:scale-100"
                  />
                );

                return (
                  <BillItemCard
                    key={bill.id}
                    status="paid"
                    name={bill.name}
                    category={categoryForLedgerBill(bill, recurringBills)}
                    dueDateDisplay={formatBillDuePrimary(bill.due_date)}
                    relativeHint={
                      optimisticRow
                        ? "Syncing to ledger…"
                        : formatBillDueTimingPaid(bill.due_date)
                    }
                    deltaDays={daysFromTodayToDueDate(bill.due_date)}
                    amountDisplay={formatMoney(Number(bill.amount))}
                    nameMuted
                    leading={paidLeading}
                    trailing={
                      !optimisticRow ? (
                        <button
                          type="button"
                          onClick={() => deleteBill(bill.id)}
                          className="rounded-lg bg-rose-100 px-2 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        >
                          Delete
                        </button>
                      ) : null
                    }
                    className={
                      optimisticRow
                        ? `balnced-bill-paid-enter ring-2 ring-emerald-400/30 ${
                            paidEnterFlashKeys[flashKey] ? "balnced-paid-flash" : ""
                          }`
                        : ""
                    }
                  />
                );
              })}

              {!loading && paidBillsMerged.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No paid bills yet.
                </p>
              )}
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Recurring bill templates" className="space-y-4 lg:space-y-5">
            <header>
              <p className={SECTION_EYEBROW}>Recurring templates</p>
              <p className={SECTION_DESC}>
                Schedule, next due date, and payment streak—derived from each template and your
                paid ledger rows.
              </p>
            </header>
            <RecurringTemplatesList
              templates={recurringBills}
              insightById={recurringInsightById}
              loading={loading}
              onDeleteTemplate={deleteRecurringBill}
            />
          </section>

          <section
            id="add-bill-template"
            aria-label="Add recurring template"
            className="scroll-mt-4 space-y-4 lg:space-y-5"
          >
            <header>
              <p className={SECTION_EYEBROW}>Add a template</p>
              <p className={SECTION_DESC}>
                Creates recurring bill rows for the current planning window.
              </p>
            </header>
            <div className="balnced-panel max-w-xl rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.12] sm:p-6">
              <form onSubmit={addRecurringBill} className="space-y-3">
                <input
                  type="text"
                  placeholder="Name"
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
                <input
                  type="text"
                  placeholder="Category (optional)"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="balnced-input"
                />
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as RecurringBill["frequency"])
                  }
                  className="balnced-select"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
                {frequency === "monthly" ? (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Day of month (1–31)"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    className="balnced-input"
                    required
                  />
                ) : (
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="balnced-select"
                    required
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Add recurring bill
                </button>
              </form>
            </div>
          </section>
      </div>
    </DashboardShell>
  );
}
