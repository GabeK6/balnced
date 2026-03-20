"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/dashboard/shell";
import {
  loadDashboardData,
  formatDateShort,
  formatMoney,
  Bill,
  RecurringBill,
  generateRecurringBills,
  addDays,
  parseDateOnlyLocal,
  toDateOnly,
} from "@/lib/dashboard-data";
import {
  billIsPaid,
  classifyBillOccurrences,
  getPaidRecurringBills,
  ledgerDueMatchesOccurrence,
  normalizeBillDueDate,
  recurringBillIdsMatch,
  type EnrichedOccurrence,
} from "@/lib/recurring-bill-occurrences";
import { supabase } from "@/lib/supabase";

function occurrenceUiKey(occ: EnrichedOccurrence): string {
  return `${occ.recurringBill.id}:${normalizeBillDueDate(occ.dueDate)}`;
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
  const [loading, setLoading] = useState(true);
  /** Immediate checkbox feedback; cleared after toggle finishes (success or error). */
  const [occurrencePaidOptimistic, setOccurrencePaidOptimistic] = useState<
    Record<string, boolean>
  >({});
  const [billActionError, setBillActionError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] =
    useState<RecurringBill["frequency"]>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("1");

  useEffect(() => {
    async function load() {
      const data = await loadDashboardData();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setBills(data.bills);
      setRecurringBills(data.recurringBills);
      setLoading(false);
    }
    load();
  }, []);

  const { overdueUnpaid: overdueOccurrences, upcomingThisMonthUnpaid: upcomingOccurrences } =
    useMemo(
      () => classifyBillOccurrences(recurringBills, bills, null, new Date()),
      [recurringBills, bills]
    );

  const paidBills = useMemo(() => getPaidRecurringBills(bills), [bills]);

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

  const setOccurrencePaid = useCallback(
    async (occ: EnrichedOccurrence, paid: boolean): Promise<boolean> => {
      setBillActionError(null);

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

      const ledgerRowsMatchOccurrence = (b: Bill) =>
        recurringBillIdsMatch(b.recurring_bill_id, occ.recurringBill.id) &&
        ledgerDueMatchesOccurrence(b.due_date, want) &&
        !b.archived;

      const verifyLedgerReflectsPaid = (list: Bill[]): boolean => {
        const rows = list.filter(ledgerRowsMatchOccurrence);
        if (!rows.length) return !paid;
        if (paid) return rows.some((r) => billIsPaid(r));
        return rows.every((r) => !billIsPaid(r));
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
          .update({ is_paid: paid })
          .in("id", billIds)
          .eq("user_id", user.id);
        if (error) {
          console.error(error);
          const msg = error.message || "Could not update bill.";
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
          .update({ is_paid: paid })
          .eq("user_id", user.id)
          .eq("recurring_bill_id", occ.recurringBill.id)
          .eq("archived", false)
          .gte("due_date", want)
          .lt("due_date", dayAfter);
        if (error) {
          console.error(error);
          const msg = error.message || "Could not update bill.";
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
          .update({ is_paid: paid })
          .eq("user_id", user.id)
          .eq("recurring_bill_id", occ.recurringBill.id)
          .eq("archived", false)
          .in("due_date", dueVariants);
        if (error) {
          console.error(error);
          const msg = error.message || "Could not update bill.";
          setBillActionError(msg);
          alert(msg);
          return false;
        }
        return true;
      };

      const tryFinish = async (): Promise<boolean> => {
        const list = await refetchBills();
        if (!list) return false;
        return verifyLedgerReflectsPaid(list);
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
      if (rpcResult.ok && rpcResult.rowCount > 0) {
        if (await tryFinish()) return true;
        await new Promise((r) => setTimeout(r, 200));
        if (await tryFinish()) return true;
        /**
         * RPC already updated `is_paid` (SECURITY DEFINER). If strict verify fails, do not
         * patch from stale `prev` (that can drop rows). Refetch only.
         */
        console.warn(
          "set_bill_occurrence_paid: verify mismatch after RPC; refetching (DB update already applied)"
        );
        await refetchBills();
        if (await refetchMatchesOccurrence()) return true;
        await new Promise((r) => setTimeout(r, 250));
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

      const { error: insertErr } = await supabase.from("bills").insert({
        user_id: user.id,
        name: occ.recurringBill.name,
        amount: Number(occ.recurringBill.amount),
        due_date: want,
        is_paid: paid,
        archived: false,
        recurring_bill_id: occ.recurringBill.id,
        is_recurring: true,
      });

      if (insertErr) {
        console.error(insertErr);
        await updatePaidByCalendarDayWindow();
        await updatePaidByDueVariants();
        if (await tryFinish()) return true;
        if (ledgerIds.length > 0) {
          await updatePaidByIds(ledgerIds);
          if (await tryFinish()) return true;
        }
        const im = insertErr.message || "Could not save bill.";
        setBillActionError(im);
        alert(im);
        return false;
      }

      if (await tryFinish()) return true;
      if (await refetchMatchesOccurrence()) return true;

      const msg =
        "Could not confirm bill was saved. Add column if missing: alter table public.bills add column if not exists is_paid boolean default false;";
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
    const { error } = await supabase
      .from("bills")
      .update({ is_paid: nextPaid })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      alert(error.message || "Could not update bill.");
      return;
    }

    await refetchBills();
  }

  function renderOccurrenceRow(occ: EnrichedOccurrence, overdue: boolean) {
    const ok = occurrenceUiKey(occ);
    const optimistic = occurrencePaidOptimistic[ok];
    const checked = optimistic !== undefined ? optimistic : occ.isPaid;

    return (
      <div
        key={`${occ.recurringBill.id}-${occ.dueDate}`}
        className={`flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between ${
          overdue
            ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-800/50"
            : "balnced-row"
        }`}
      >
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={checked ? "Mark as unpaid" : "Mark as paid"}
            onClick={() => {
              setBillActionError(null);
              const nextPaid = !checked;
              setOccurrencePaidOptimistic((prev) => ({ ...prev, [ok]: nextPaid }));
              void (async () => {
                try {
                  const okSave = await setOccurrencePaid(occ, nextPaid);
                  if (!okSave) {
                    const msg =
                      "Could not mark this bill paid. See the red message above or open DevTools (F12) → Console.";
                    setBillActionError((prev) => prev ?? msg);
                    console.warn("setOccurrencePaid returned false", {
                      recurringId: occ.recurringBill.id,
                      due: normalizeBillDueDate(occ.dueDate),
                    });
                  }
                } catch (err) {
                  console.error(err);
                  const msg =
                    err instanceof Error ? err.message : String(err ?? "Could not update bill.");
                  setBillActionError(msg);
                  alert(msg);
                } finally {
                  setOccurrencePaidOptimistic((prev) => {
                    const { [ok]: _, ...rest } = prev;
                    return rest;
                  });
                }
              })();
            }}
            className={`relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold leading-none focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              checked
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "cursor-pointer border-slate-300 bg-transparent hover:border-slate-400 dark:border-slate-500 dark:hover:border-slate-400"
            }`}
          >
            {checked ? "✓" : ""}
          </button>
          <div>
            <p className="font-medium text-slate-100">
              {occ.recurringBill.name}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDateShort(occ.dueDate)}
              {overdue ? " · overdue" : ""}
              {occ.recurringBill.category
                ? ` · ${occ.recurringBill.category}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-8 sm:pl-0">
          <p className="font-semibold text-slate-100">
            {formatMoney(Number(occ.recurringBill.amount))}
          </p>
          {occ.billId ? (
            <button
              type="button"
              onClick={() => deleteBill(occ.billId!)}
              className="rounded-lg bg-rose-100 px-2 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            >
              Delete
            </button>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Planned
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <DashboardShell
      title="Bills"
      subtitle="Recurring templates drive Upcoming, Overdue, and Paid this month."
      backHref="/dashboard"
      backLabel="Back to Overview"
      compact
    >
      <>
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

        <div className="grid h-full min-h-0 gap-4 sm:gap-5 lg:grid-cols-3">
        <div className="balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-100">
            Add recurring bill
          </h2>

          <form onSubmit={addRecurringBill} className="mt-4 grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Bill name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="balnced-input col-span-2"
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
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="balnced-input"
            />

            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurringBill["frequency"])
              }
              className="balnced-input balnced-select"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>

            {frequency === "monthly" ? (
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Day of month"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="balnced-input"
                required
              />
            ) : (
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="balnced-input balnced-select"
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
              className="col-span-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Add recurring bill
            </button>
          </form>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
          <h2 className="shrink-0 text-base font-semibold text-slate-100">
            Your templates
          </h2>

          <div className="mt-3 max-h-64 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {recurringBills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-3 balnced-row rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {bill.name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {bill.frequency === "monthly"
                      ? `Monthly on day ${bill.day_of_month}`
                      : `${bill.frequency} • day ${bill.day_of_week}`}
                    {bill.category ? ` • ${bill.category}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-100">
                    {formatMoney(Number(bill.amount))}
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteRecurringBill(bill.id)}
                    className="rounded-lg bg-rose-100 px-2 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {!loading && recurringBills.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-600">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No recurring bills
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add your first bill to improve safe-to-spend accuracy.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <div className="flex min-h-0 max-h-72 flex-1 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
            <h2 className="shrink-0 text-base font-semibold text-slate-100">
              Overdue
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Due before today (this cycle). Check off to mark paid.
            </p>
            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {overdueOccurrences.map((occ) => renderOccurrenceRow(occ, true))}
              {!loading && overdueOccurrences.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nothing overdue.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 max-h-72 flex-1 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
            <h2 className="shrink-0 text-base font-semibold text-slate-100">
              Upcoming (this month)
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Due today through month-end, sorted by date.
            </p>
            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {upcomingOccurrences.map((occ) => renderOccurrenceRow(occ, false))}
              {!loading && upcomingOccurrences.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No more bills due this month.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-0 max-h-72 flex-1 flex-col overflow-hidden balnced-panel rounded-2xl p-5 sm:p-6">
            <h2 className="shrink-0 text-base font-semibold text-slate-100">
              Paid
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Marked paid in your ledger.
            </p>
            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {paidBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex flex-col gap-2 balnced-row rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!bill.is_paid}
                      onChange={() => {
                        void toggleBillPaid(bill.id, !!bill.is_paid);
                      }}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 dark:border-slate-500"
                    />
                    <div>
                      <p className="font-medium text-slate-100 line-through opacity-75">
                        {bill.name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatDateShort(bill.due_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-8 sm:pl-0">
                    <p className="font-semibold text-slate-100">
                      {formatMoney(Number(bill.amount))}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteBill(bill.id)}
                      className="rounded-lg bg-rose-100 px-2 py-1.5 text-xs font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {!loading && paidBills.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No paid bills yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
    </DashboardShell>
  );
}
