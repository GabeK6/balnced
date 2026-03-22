import type { Bill, RecurringBill } from "@/lib/dashboard-data";
import { addDays, parseDateOnlyLocal, toDateOnly } from "@/lib/dashboard-data";

/** YYYY-MM-DD → Date at local midnight (never UTC-shifted). */
function localCalendarDay(iso: string): Date {
  const d = parseDateOnlyLocal(iso);
  if (d) return d;
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** Compare bill rows to computed YYYY-MM-DD (Supabase may return full ISO timestamps). */
export function normalizeBillDueDate(due: string | null | undefined): string {
  if (due == null || due === "") return "";
  const s = String(due).trim();
  const ymd = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toDateOnly(parsed);
  return "";
}

/**
 * True when a ledger `due_date` (date, timestamp, or ISO string) is the same **local calendar day**
 * as `wantYmd` (YYYY-MM-DD). Avoids false mismatches between UI occurrence dates and DB timestamps.
 */
export function billDueOnCalendarDay(
  billDueDate: string | null | undefined,
  wantYmd: string
): boolean {
  if (billDueDate == null || billDueDate === "" || !wantYmd) return false;
  const want = parseDateOnlyLocal(normalizeBillDueDate(wantYmd));
  if (!want) return false;

  const s = String(billDueDate).trim();
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) {
    const bill = parseDateOnlyLocal(head[1]);
    if (bill && bill.getTime() === want.getTime()) return true;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return (
      parsed.getFullYear() === want.getFullYear() &&
      parsed.getMonth() === want.getMonth() &&
      parsed.getDate() === want.getDate()
    );
  }
  return false;
}

/**
 * IDs from Supabase may differ by UUID case or hyphenation vs `::text` in SQL.
 */
export function recurringBillIdsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const norm = (x: string) => x.trim().toLowerCase().replace(/-/g, "");
  const x = norm(String(a ?? ""));
  const y = norm(String(b ?? ""));
  return x.length > 0 && x === y;
}

/**
 * Canonical key: normalized recurring template id + calendar due date (YYYY-MM-DD).
 * Use for paid vs unpaid occurrence matching so duplicate ledger rows still align.
 */
export function occurrenceOccurrenceKey(
  recurringBillId: string | null | undefined,
  dueYmd: string
): string {
  const normId = String(recurringBillId ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "");
  const normDue = normalizeBillDueDate(dueYmd);
  return `${normId}|${normDue}`;
}

/**
 * Aligns with RPC `left(b.due_date::text, 10) = want` plus calendar-day checks.
 */
export function ledgerDueMatchesOccurrence(
  billDueDate: string | null | undefined,
  wantYmd: string
): boolean {
  const w = normalizeBillDueDate(wantYmd);
  if (!w) return false;
  if (billDueOnCalendarDay(billDueDate, w)) return true;
  if (normalizeBillDueDate(billDueDate) === w) return true;
  const raw = String(billDueDate ?? "").trim();
  if (raw.length >= 10) {
    const head = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(head) && head === w) return true;
  }
  return false;
}

export type EnrichedOccurrence = {
  recurringBill: RecurringBill;
  dueDate: string;
  /** Matching row in `bills`, if it exists */
  billId?: string;
  isPaid: boolean;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function toDateOnlyStr(d: Date): string {
  return toDateOnly(d);
}

function addDaysLocal(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function isTemplateActive(bill: RecurringBill): boolean {
  return bill.active !== false;
}

function isDueInTemplateWindow(bill: RecurringBill, candidate: Date): boolean {
  const c = startOfDay(candidate);
  if (bill.start_date) {
    const s = startOfDay(new Date(bill.start_date));
    if (c < s) return false;
  }
  if (bill.end_date) {
    const e = startOfDay(new Date(bill.end_date));
    if (c > e) return false;
  }
  return true;
}

/** Monthly: due date in the bill's calendar month (day clamped to last day of month). */
export function getMonthlyDueInMonth(
  bill: RecurringBill,
  year: number,
  monthIndex0: number
): string | null {
  if (bill.frequency !== "monthly" || bill.day_of_month == null) return null;
  const dom = Number(bill.day_of_month);
  if (dom < 1 || dom > 31) return null;
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const day = Math.min(dom, lastDay);
  return toDateOnlyStr(new Date(year, monthIndex0, day));
}

function intervalDaysForFrequency(freq: RecurringBill["frequency"]): number {
  if (freq === "weekly") return 7;
  if (freq === "biweekly") return 14;
  return 0;
}

/**
 * Next due date on or after `now` (local midnight), respecting start/end template window.
 */
export function getNextDueDate(bill: RecurringBill, now: Date): string | null {
  if (!isTemplateActive(bill)) return null;

  const now0 = startOfDay(now);

  if (bill.frequency === "monthly" && bill.day_of_month != null) {
    const dom = Number(bill.day_of_month);
    if (dom < 1 || dom > 31) return null;

    let y = now0.getFullYear();
    let m = now0.getMonth();

    for (let i = 0; i < 36; i++) {
      const dueStr = getMonthlyDueInMonth(bill, y, m);
      if (!dueStr) return null;
      const due = startOfDay(localCalendarDay(dueStr));
      if (due >= now0 && isDueInTemplateWindow(bill, due)) return dueStr;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return null;
  }

  if (
    (bill.frequency === "weekly" || bill.frequency === "biweekly") &&
    bill.day_of_week != null
  ) {
    const interval = intervalDaysForFrequency(bill.frequency);
    const dow = bill.day_of_week;

    let cursor = bill.start_date
      ? startOfDay(new Date(bill.start_date))
      : new Date(now0);

    while (cursor.getDay() !== dow) {
      cursor = addDaysLocal(cursor, 1);
    }

    while (cursor < now0) {
      cursor = addDaysLocal(cursor, interval);
    }

    let guard = 0;
    while (!isDueInTemplateWindow(bill, cursor) && guard < 200) {
      cursor = addDaysLocal(cursor, interval);
      guard++;
    }
    if (!isDueInTemplateWindow(bill, cursor)) return null;
    return toDateOnlyStr(cursor);
  }

  return null;
}

/**
 * For monthly: this month's due date (may be before `now` → overdue).
 * For weekly/biweekly: same as {@link getNextDueDate} (earliest due on or after now).
 */
export function getPeriodAnchorDueDate(bill: RecurringBill, now: Date): string | null {
  if (!isTemplateActive(bill)) return null;

  if (bill.frequency === "monthly" && bill.day_of_month != null) {
    const y = now.getFullYear();
    const m = now.getMonth();
    const dueStr = getMonthlyDueInMonth(bill, y, m);
    if (!dueStr) return null;
    const due = startOfDay(localCalendarDay(dueStr));
    if (!isDueInTemplateWindow(bill, due)) return null;
    return dueStr;
  }

  return getNextDueDate(bill, now);
}

/** All non-archived ledger rows for this template occurrence (same calendar due date). */
function findBillsForOccurrence(
  bills: Bill[],
  recurringBillId: string,
  dueDate: string
): Bill[] {
  const want = normalizeBillDueDate(dueDate);
  return bills.filter(
    (b) =>
      recurringBillIdsMatch(b.recurring_bill_id, recurringBillId) &&
      ledgerDueMatchesOccurrence(b.due_date, want) &&
      !b.archived
  );
}

/** DB may omit `is_recurring` for older rows; use `recurring_bill_id` as source of truth. */
export function isRecurringBillRow(b: Bill): boolean {
  return (
    b.is_recurring === true ||
    (b.recurring_bill_id != null && String(b.recurring_bill_id).length > 0)
  );
}

export function billIsPaid(b: Bill | undefined | null): boolean {
  if (!b) return false;
  const v = b.is_paid as unknown;
  if (v === true || v === 1 || v === "true" || v === "t" || v === "T" || v === "1")
    return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "yes" || s === "y" || s === "on") return true;
  }
  if (
    v === false ||
    v === 0 ||
    v === "false" ||
    v === "f" ||
    v === "F" ||
    v === null ||
    v === ""
  )
    return false;
  // Omitted from JSON (e.g. stale PostgREST cache) — infer from paid_at when present.
  const pa = b.paid_at;
  if (pa != null && String(pa).trim() !== "") return true;
  if (v === undefined) return false;
  return Boolean(v);
}

/** Paid occurrence keys from ledger — survives duplicate rows and due_date format drift. */
export function buildPaidOccurrenceKeySet(bills: Bill[]): Set<string> {
  const s = new Set<string>();
  for (const b of bills) {
    if (b.archived || !billIsPaid(b)) continue;
    if (b.recurring_bill_id == null || String(b.recurring_bill_id).length === 0) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd) continue;
    s.add(occurrenceOccurrenceKey(b.recurring_bill_id, nd));
  }
  return s;
}

/**
 * Single source of truth for “this recurring occurrence is paid in the ledger”
 * (same key as getOverdueBills / enrich paid map).
 * Pass `paidKeySet` from buildPaidOccurrenceKeySet(bills) to avoid rebuilding the set.
 */
export function hasPaidLedgerOccurrence(
  bills: Bill[],
  recurringBillId: string,
  dueDateRaw: string,
  paidKeySet?: Set<string>
): boolean {
  const want = normalizeBillDueDate(dueDateRaw);
  if (!want) return false;
  const k = occurrenceOccurrenceKey(recurringBillId, want);
  const set = paidKeySet ?? buildPaidOccurrenceKeySet(bills);
  if (set.has(k)) return true;
  return bills.some(
    (b) =>
      !b.archived &&
      billIsPaid(b) &&
      recurringBillIdsMatch(b.recurring_bill_id, recurringBillId) &&
      ledgerDueMatchesOccurrence(b.due_date, want)
  );
}

const DEBUG_OCCURRENCE =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function debugOccurrenceMatch(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_OCCURRENCE) return;
  if (typeof window === "undefined" || sessionStorage.getItem("balnced_debug_occurrence") !== "1") {
    return;
  }
  console.debug(`[balnced:occurrence] ${label}`, payload);
}

function enrich(
  bill: RecurringBill,
  dueDate: string,
  bills: Bill[],
  paidOccurrenceKeys: Set<string>
): EnrichedOccurrence {
  const rows = findBillsForOccurrence(bills, bill.id, dueDate);
  const wantNorm = normalizeBillDueDate(dueDate);
  const mapSaysPaid =
    wantNorm.length > 0 &&
    paidOccurrenceKeys.has(occurrenceOccurrenceKey(bill.id, wantNorm));
  const anyPaid = rows.some((r) => billIsPaid(r)) || mapSaysPaid;
  const paidRow = rows.find((r) => billIsPaid(r));
  /** Prefer a paid row for delete/targeting when duplicates exist. */
  const primary = paidRow ?? rows[0];
  if (mapSaysPaid && !rows.some((r) => billIsPaid(r))) {
    debugOccurrenceMatch("enrich: paid map overrides row scan (likely duplicate / date mismatch)", {
      templateId: bill.id,
      dueDate,
      wantNorm,
      rowCount: rows.length,
    });
  }
  return {
    recurringBill: bill,
    dueDate,
    billId: primary?.id,
    isPaid: anyPaid,
  };
}

/** Sort by due date ascending (earliest / most overdue first). */
export function sortByDueDateAsc<T extends { dueDate: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Paid recurring rows, most recently due first — one row per template + calendar due. */
export function getPaidRecurringBills(bills: Bill[]): Bill[] {
  const paid = bills.filter(
    (b) => !b.archived && billIsPaid(b) && isRecurringBillRow(b)
  );
  const byKey = new Map<string, Bill>();
  for (const b of paid) {
    const rid = b.recurring_bill_id;
    if (rid == null || String(rid).length === 0) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd) continue;
    const k = occurrenceOccurrenceKey(rid, nd);
    if (!byKey.has(k)) byKey.set(k, b);
  }
  return [...byKey.values()].sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
}

/**
 * Weekly/biweekly overdue: last scheduled occurrence before `now` when the next due is still in the future.
 */
function getWeeklyOverdueDueDate(
  bill: RecurringBill,
  now: Date
): string | null {
  if (
    bill.frequency !== "weekly" &&
    bill.frequency !== "biweekly"
  ) {
    return null;
  }
  if (bill.day_of_week == null) return null;

  const interval = intervalDaysForFrequency(bill.frequency);
  const nextStr = getNextDueDate(bill, now);
  if (!nextStr) return null;

  const next = startOfDay(localCalendarDay(nextStr));
  const now0 = startOfDay(now);

  if (next.getTime() === now0.getTime()) return null;

  const prev = addDaysLocal(next, -interval);
  if (prev < now0 && isDueInTemplateWindow(bill, prev)) {
    return toDateOnlyStr(prev);
  }
  return null;
}

/**
 * Templates with a due date strictly before today and no paid row for that occurrence.
 */
export function getOverdueBills(
  recurring: RecurringBill[],
  bills: Bill[],
  now: Date = new Date()
): EnrichedOccurrence[] {
  const now0 = startOfDay(now);
  const out: EnrichedOccurrence[] = [];
  const paidOccurrenceKeys = buildPaidOccurrenceKeySet(bills);

  debugOccurrenceMatch("getOverdueBills: paid occurrence keys", {
    count: paidOccurrenceKeys.size,
    sample: [...paidOccurrenceKeys].slice(0, 30),
  });

  for (const bill of recurring) {
    if (!isTemplateActive(bill)) continue;

    let overdueDue: string | null = null;

    if (bill.frequency === "monthly" && bill.day_of_month != null) {
      const anchor = getPeriodAnchorDueDate(bill, now);
      if (anchor && localCalendarDay(anchor) < now0) {
        overdueDue = anchor;
      }
    } else if (
      bill.frequency === "weekly" ||
      bill.frequency === "biweekly"
    ) {
      overdueDue = getWeeklyOverdueDueDate(bill, now);
    }

    if (!overdueDue) continue;

    const occKey = occurrenceOccurrenceKey(bill.id, overdueDue);
    if (paidOccurrenceKeys.has(occKey)) {
      debugOccurrenceMatch("getOverdueBills: skip — in paid map", { occKey, name: bill.name });
      continue;
    }

    const row = enrich(bill, overdueDue, bills, paidOccurrenceKeys);
    if (row.isPaid) continue;
    out.push(row);
  }

  return sortByDueDateAsc(out);
}

/**
 * Due from today through end of current calendar month, not overdue, not paid.
 */
export function getUpcomingBills(
  recurring: RecurringBill[],
  bills: Bill[],
  now: Date = new Date()
): EnrichedOccurrence[] {
  const now0 = startOfDay(now);
  const monthEnd = startOfDay(endOfMonth(now));
  const overdueKeys = new Set(
    getOverdueBills(recurring, bills, now).map((o) =>
      occurrenceOccurrenceKey(o.recurringBill.id, o.dueDate)
    )
  );

  const paidOccurrenceKeys = buildPaidOccurrenceKeySet(bills);

  const out: EnrichedOccurrence[] = [];

  for (const bill of recurring) {
    if (!isTemplateActive(bill)) continue;

    let candidate: string | null = null;

    if (bill.frequency === "monthly" && bill.day_of_month != null) {
      const anchor = getPeriodAnchorDueDate(bill, now);
      if (!anchor) continue;
      const a = startOfDay(localCalendarDay(anchor));
      if (a >= now0 && a <= monthEnd) candidate = anchor;
    } else {
      candidate = getNextDueDate(bill, now);
      if (!candidate) continue;
      const c = startOfDay(localCalendarDay(candidate));
      if (c > monthEnd) continue;
      if (c < now0) continue;
    }

    if (!candidate) continue;
    const key = occurrenceOccurrenceKey(bill.id, candidate);
    if (overdueKeys.has(key)) continue;

    if (paidOccurrenceKeys.has(key)) {
      debugOccurrenceMatch("getUpcomingBills: skip — in paid map", { key, name: bill.name });
      continue;
    }

    const row = enrich(bill, candidate, bills, paidOccurrenceKeys);
    if (row.isPaid) continue;
    out.push(row);
  }

  return sortByDueDateAsc(out);
}

/** All due dates for a template that fall in [rangeStart, rangeEnd] (inclusive), local calendar days. */
function listDueDatesInClosedRange(
  bill: RecurringBill,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  if (re < rs) return [];

  const out: string[] = [];

  if (bill.frequency === "monthly" && bill.day_of_month != null) {
    let y = rs.getFullYear();
    let m = rs.getMonth();
    const endY = re.getFullYear();
    const endM = re.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      const dStr = getMonthlyDueInMonth(bill, y, m);
      if (dStr) {
        const dt = startOfDay(localCalendarDay(dStr));
        if (dt >= rs && dt <= re && isDueInTemplateWindow(bill, dt)) {
          out.push(dStr);
        }
      }
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return out;
  }

  if (
    (bill.frequency === "weekly" || bill.frequency === "biweekly") &&
    bill.day_of_week != null
  ) {
    let dStr = getNextDueDate(bill, rs);
    for (let guard = 0; dStr && guard < 64; guard++) {
      const dt = startOfDay(localCalendarDay(dStr));
      if (dt > re) break;
      if (dt >= rs && isDueInTemplateWindow(bill, dt)) {
        out.push(dStr);
      }
      dStr = getNextDueDate(bill, addDaysLocal(dt, 1));
    }
    return out;
  }

  return [];
}

/** One line for Overview safe-to-spend / "Bills before payday" (DB row or computed from template). */
export type DashboardUpcomingBillLine = {
  id: string;
  name: string;
  amount: number;
  due_date: string;
};

/**
 * How far back we scan for unpaid obligations (overdue) in cash-flow / dashboard math.
 * Keep this bounded — multi-year lookbacks treated years of virtual + ledger lines as “overdue”.
 */
export const BILL_OBLIGATION_LOOKBACK_DAYS = 120;

/**
 * Unpaid bills with due date in [rangeStart, rangeEnd] (inclusive), local calendar days.
 * Same merge rules as dashboard “bills before payday” (DB rows + template occurrences).
 *
 * Any non-archived recurring ledger row (paid or unpaid) blocks a duplicate virtual line for
 * that template + due date — paid rows must not leave a synthetic unpaid occurrence behind.
 */
export function getDashboardBillsInClosedRange(
  recurring: RecurringBill[],
  bills: Bill[],
  rangeStart: Date,
  rangeEnd: Date
): DashboardUpcomingBillLine[] {
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  if (re < rs) return [];

  const rsStr = toDateOnlyStr(rs);
  const reStr = toDateOnlyStr(re);

  const recurringKeyCovered = new Set<string>();
  /** Internal: track template id so we keep one obligation line per recurring stream. */
  type LineWithRec = DashboardUpcomingBillLine & { _recurringId: string | null };
  const result: LineWithRec[] = [];

  for (const b of bills) {
    if (b.archived) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd || nd < rsStr || nd > reStr) continue;
    if (b.recurring_bill_id != null && String(b.recurring_bill_id).length > 0) {
      recurringKeyCovered.add(occurrenceOccurrenceKey(String(b.recurring_bill_id), nd));
    }
  }

  const seenUnpaidRecurring = new Set<string>();

  for (const b of bills) {
    if (b.archived || billIsPaid(b)) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd || nd < rsStr || nd > reStr) continue;
    const recId =
      b.recurring_bill_id != null && String(b.recurring_bill_id).length > 0
        ? String(b.recurring_bill_id)
        : null;
    if (recId) {
      const occK = occurrenceOccurrenceKey(recId, nd);
      if (seenUnpaidRecurring.has(occK)) continue;
      seenUnpaidRecurring.add(occK);
    }
    result.push({
      id: String(b.id),
      name: b.name,
      amount: Number(b.amount),
      due_date: nd,
      _recurringId: recId,
    });
  }

  for (const tmpl of recurring) {
    if (!isTemplateActive(tmpl)) continue;
    for (const dueStr of listDueDatesInClosedRange(tmpl, rs, re)) {
      const key = occurrenceOccurrenceKey(String(tmpl.id), dueStr);
      if (recurringKeyCovered.has(key)) continue;
      recurringKeyCovered.add(key);
      result.push({
        id: `virtual-${tmpl.id}-${dueStr}`,
        name: tmpl.name,
        amount: Number(tmpl.amount),
        due_date: dueStr,
        _recurringId: String(tmpl.id),
      });
    }
  }

  const oneTime = result.filter((l) => l._recurringId == null);
  const earliestByRecurring = new Map<string, LineWithRec>();
  for (const l of result) {
    if (l._recurringId == null) continue;
    const prev = earliestByRecurring.get(l._recurringId);
    if (!prev || l.due_date < prev.due_date) {
      earliestByRecurring.set(l._recurringId, l);
    }
  }

  const merged = [...oneTime, ...earliestByRecurring.values()].sort((a, b) =>
    a.due_date.localeCompare(b.due_date)
  );
  return merged.map(({ _recurringId: _r, ...line }) => line);
}

/**
 * Unpaid bills due on or before next payday (inclusive), including overdue (due before today).
 * Merges `bills` rows with template-driven occurrences when no row exists yet.
 * If payday is unknown, uses end of the current calendar month.
 */
export function getDashboardBillsBeforePayday(
  recurring: RecurringBill[],
  bills: Bill[],
  paydayIso: string | null | undefined,
  now: Date = new Date()
): DashboardUpcomingBillLine[] {
  const today0 = startOfDay(now);
  let windowEnd: Date;

  if (paydayIso) {
    const p = startOfDay(new Date(paydayIso));
    if (Number.isNaN(p.getTime())) {
      windowEnd = startOfDay(endOfMonth(now));
    } else {
      windowEnd = p < today0 ? startOfDay(endOfMonth(now)) : p;
    }
  } else {
    windowEnd = startOfDay(endOfMonth(now));
  }

  const rangeStart = addDaysLocal(today0, -BILL_OBLIGATION_LOOKBACK_DAYS);
  return getDashboardBillsInClosedRange(recurring, bills, rangeStart, windowEnd);
}

/** Alias: unpaid obligations due on or before payday (includes overdue). */
export function getBillsDueBeforePayday(
  recurring: RecurringBill[],
  bills: Bill[],
  paydayIso: string | null | undefined,
  now?: Date
): DashboardUpcomingBillLine[] {
  return getDashboardBillsBeforePayday(recurring, bills, paydayIso, now);
}

/**
 * Derive merged bill lines (one-time + recurring/virtual) for any local date window.
 */
export function deriveBillOccurrences(
  templates: RecurringBill[],
  bills: Bill[],
  rangeStart: Date,
  rangeEnd: Date
): DashboardUpcomingBillLine[] {
  return getDashboardBillsInClosedRange(templates, bills, rangeStart, rangeEnd);
}

/** Paid recurring rows with due date in the same calendar month as `now` — deduped per occurrence. */
export function getPaidBillsThisMonth(bills: Bill[], now: Date = new Date()): Bill[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const inMonth = bills.filter((b) => {
    if (b.archived || !billIsPaid(b) || !isRecurringBillRow(b)) return false;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd) return false;
    const d = localCalendarDay(nd);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const byKey = new Map<string, Bill>();
  for (const b of inMonth) {
    const rid = b.recurring_bill_id;
    if (rid == null || String(rid).length === 0) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd) continue;
    const k = occurrenceOccurrenceKey(rid, nd);
    if (!byKey.has(k)) byKey.set(k, b);
  }
  return [...byKey.values()].sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
}

/** Calendar days from `now`’s date to `dueYmd` (negative = due date is in the past). */
export function daysFromTodayToDueDate(dueYmd: string, now: Date = new Date()): number {
  const head = normalizeBillDueDate(dueYmd);
  if (!head) return 0;
  const today = startOfDay(now);
  const due = startOfDay(localCalendarDay(head));
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Human-readable due timing for bill cards, e.g. "Due in 3 days", "3 days late".
 */
export function formatBillRelativeDue(dueYmd: string, now: Date = new Date()): string {
  const delta = daysFromTodayToDueDate(dueYmd, now);
  if (delta < 0) {
    const n = Math.abs(delta);
    return n === 1 ? "1 day late" : `${n} days late`;
  }
  if (delta === 0) return "Due Today";
  if (delta === 1) return "Due Tomorrow";
  return `Due in ${delta} days`;
}

/** Paid ledger rows: timing vs today without implying still overdue. */
export function formatBillDueTimingPaid(dueYmd: string, now: Date = new Date()): string {
  const delta = daysFromTodayToDueDate(dueYmd, now);
  if (delta < 0) {
    const n = Math.abs(delta);
    return n === 1 ? "Was due yesterday" : `Was due ${n} days ago`;
  }
  if (delta === 0) return "Due date is today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta} days`;
}

/** Most urgent overdue = oldest due date first (longest past due). */
export function sortOverdueMostUrgentFirst(occ: EnrichedOccurrence[]): EnrichedOccurrence[] {
  return [...occ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Soonest upcoming due first. */
export function sortUpcomingSoonestFirst(occ: EnrichedOccurrence[]): EnrichedOccurrence[] {
  return [...occ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Split month-scoped upcoming bills: **this week** = due in 0–6 days from today (rolling),
 * **later this month** = still this calendar month but beyond that window.
 */
export function partitionUpcomingThisWeekVsLater(
  upcoming: EnrichedOccurrence[],
  now: Date = new Date()
): { thisWeek: EnrichedOccurrence[]; laterThisMonth: EnrichedOccurrence[] } {
  const sorted = sortUpcomingSoonestFirst(upcoming);
  const thisWeek: EnrichedOccurrence[] = [];
  const laterThisMonth: EnrichedOccurrence[] = [];
  for (const o of sorted) {
    const delta = daysFromTodayToDueDate(o.dueDate, now);
    if (delta >= 0 && delta <= 6) thisWeek.push(o);
    else laterThisMonth.push(o);
  }
  return { thisWeek, laterThisMonth };
}

/** Calendar days past due (0 if not overdue). */
export function daysPastDue(dueYmd: string, now: Date = new Date()): number {
  const d = daysFromTodayToDueDate(dueYmd, now);
  return d >= 0 ? 0 : Math.abs(d);
}

/**
 * Overdue: **recent** = 1–7 days past due, **older** = 8+ days past due.
 * Each bucket stays sorted most urgent first (oldest due date first).
 */
export function partitionOverdueByRecency(
  overdue: EnrichedOccurrence[],
  now: Date = new Date()
): { recent: EnrichedOccurrence[]; older: EnrichedOccurrence[] } {
  const sorted = sortOverdueMostUrgentFirst(overdue);
  const recent: EnrichedOccurrence[] = [];
  const older: EnrichedOccurrence[] = [];
  for (const o of sorted) {
    const late = daysPastDue(o.dueDate, now);
    if (late <= 7) recent.push(o);
    else older.push(o);
  }
  return { recent, older };
}

/**
 * Within rolling “this week” (0–6 days out), split **next 2 days** (today + tomorrow)
 * vs **rest of the week** (2–6 days out). Soonest due first within each.
 */
export function partitionThisWeekNextTwoVsRest(
  thisWeek: EnrichedOccurrence[],
  now: Date = new Date()
): { nextTwoDays: EnrichedOccurrence[]; restOfWeek: EnrichedOccurrence[] } {
  const sorted = sortUpcomingSoonestFirst(thisWeek);
  const nextTwoDays: EnrichedOccurrence[] = [];
  const restOfWeek: EnrichedOccurrence[] = [];
  for (const o of sorted) {
    const delta = daysFromTodayToDueDate(o.dueDate, now);
    if (delta >= 0 && delta <= 1) nextTwoDays.push(o);
    else restOfWeek.push(o);
  }
  return { nextTwoDays, restOfWeek };
}

export function sumEnrichedOccurrenceAmounts(occ: EnrichedOccurrence[]): number {
  return occ.reduce((s, o) => s + Math.max(0, Number(o.recurringBill.amount) || 0), 0);
}

export function sumBillAmounts(rows: Bill[]): number {
  return rows.reduce((s, b) => s + Math.max(0, Number(b.amount) || 0), 0);
}

/**
 * Estimated typical monthly outflow from active recurring templates
 * (monthly = 1×, weekly ≈ 52/12×, biweekly ≈ 26/12×).
 */
export function estimateMonthlyRecurringTotal(recurring: RecurringBill[]): number {
  return recurring.filter((b) => isTemplateActive(b)).reduce((s, b) => {
    const amt = Math.max(0, Number(b.amount) || 0);
    if (b.frequency === "monthly") return s + amt;
    if (b.frequency === "weekly") return s + (amt * 52) / 12;
    if (b.frequency === "biweekly") return s + (amt * 26) / 12;
    return s;
  }, 0);
}

/**
 * One classification pass for Bills / Overview / Projection documentation —
 * uses the same overdue/upcoming/before-payday helpers everywhere.
 */
export function classifyBillOccurrences(
  recurring: RecurringBill[],
  bills: Bill[],
  nextPaydayIso: string | null | undefined,
  now: Date = new Date()
): {
  overdueUnpaid: EnrichedOccurrence[];
  upcomingThisMonthUnpaid: EnrichedOccurrence[];
  dueBeforePaydayUnpaid: DashboardUpcomingBillLine[];
  paidThisMonth: Bill[];
} {
  return {
    overdueUnpaid: getOverdueBills(recurring, bills, now),
    upcomingThisMonthUnpaid: getUpcomingBills(recurring, bills, now),
    dueBeforePaydayUnpaid: getDashboardBillsBeforePayday(recurring, bills, nextPaydayIso, now),
    paidThisMonth: getPaidBillsThisMonth(bills, now),
  };
}
