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
  if (
    v === false ||
    v === 0 ||
    v === "false" ||
    v === "f" ||
    v === "F" ||
    v === null ||
    v === undefined ||
    v === ""
  )
    return false;
  return Boolean(v);
}

function enrich(
  bill: RecurringBill,
  dueDate: string,
  bills: Bill[]
): EnrichedOccurrence {
  const rows = findBillsForOccurrence(bills, bill.id, dueDate);
  const anyPaid = rows.some((r) => billIsPaid(r));
  const paidRow = rows.find((r) => billIsPaid(r));
  /** Prefer a paid row for delete/targeting when duplicates exist. */
  const primary = paidRow ?? rows[0];
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

/** Paid recurring rows, most recently due first. */
export function getPaidRecurringBills(bills: Bill[]): Bill[] {
  return bills
    .filter(
      (b) => !b.archived && billIsPaid(b) && isRecurringBillRow(b)
    )
    .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
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

    const row = enrich(bill, overdueDue, bills);
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
    getOverdueBills(recurring, bills, now).map(
      (o) => `${o.recurringBill.id}:${o.dueDate}`
    )
  );

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
    const key = `${bill.id}:${candidate}`;
    if (overdueKeys.has(key)) continue;

    const row = enrich(bill, candidate, bills);
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
      recurringKeyCovered.add(`${String(b.recurring_bill_id)}|${nd}`);
    }
  }

  for (const b of bills) {
    if (b.archived || billIsPaid(b)) continue;
    const nd = normalizeBillDueDate(b.due_date);
    if (!nd || nd < rsStr || nd > reStr) continue;
    const recId =
      b.recurring_bill_id != null && String(b.recurring_bill_id).length > 0
        ? String(b.recurring_bill_id)
        : null;
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
      const key = `${String(tmpl.id)}|${dueStr}`;
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

/** Paid recurring rows with due date in the same calendar month as `now`. */
export function getPaidBillsThisMonth(bills: Bill[], now: Date = new Date()): Bill[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  return bills
    .filter((b) => {
      if (b.archived || !billIsPaid(b) || !isRecurringBillRow(b)) return false;
      const nd = normalizeBillDueDate(b.due_date);
      if (!nd) return false;
      const d = localCalendarDay(nd);
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
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
