"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEBT_TYPES,
  DEBT_TYPE_LABELS,
  type Debt,
  type DebtType,
} from "@/lib/debt";

type Props = {
  open: boolean;
  mode: "add" | "edit";
  initial: Debt | null;
  saving: boolean;
  /** Shown below the form (e.g. Supabase errors) — visible while the dialog is open. */
  submitError?: string | null;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    debt_type: DebtType;
    balance: number;
    apr: number;
    minimum_payment: number;
    due_day: number | null;
    credit_limit: number | null;
    lender: string | null;
    notes: string | null;
  }) => void;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none ring-emerald-500/0 transition placeholder:text-slate-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400";

function parseNonNegative(s: string): { ok: true; value: number } | { ok: false; message: string } {
  const t = s.trim();
  if (t === "") return { ok: true, value: 0 };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, message: "Enter a valid number." };
  if (n < 0) return { ok: false, message: "Cannot be negative." };
  return { ok: true, value: n };
}

function parseOptionalNonNegative(
  s: string
): { ok: true; value: number | null } | { ok: false; message: string } {
  const t = s.trim();
  if (t === "") return { ok: true, value: null };
  return parseNonNegative(t);
}

export default function DebtFormModal({
  open,
  mode,
  initial,
  saving,
  submitError = null,
  onClose,
  onSubmit,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [debtType, setDebtType] = useState<DebtType>("credit_card");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minimumPayment, setMinimumPayment] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [lender, setLender] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (mode === "edit" && initial) {
      setName(initial.name);
      setDebtType(
        DEBT_TYPES.includes(initial.debt_type as DebtType)
          ? (initial.debt_type as DebtType)
          : "other"
      );
      setBalance(String(initial.balance ?? ""));
      setApr(String(initial.apr ?? ""));
      setMinimumPayment(String(initial.minimum_payment ?? ""));
      setDueDay(initial.due_day != null ? String(initial.due_day) : "");
      setCreditLimit(
        initial.credit_limit != null && initial.credit_limit > 0
          ? String(initial.credit_limit)
          : ""
      );
      setLender(initial.lender ?? "");
      setNotes(initial.notes ?? "");
    } else {
      setName("");
      setDebtType("credit_card");
      setBalance("");
      setApr("");
      setMinimumPayment("");
      setDueDay("");
      setCreditLimit("");
      setLender("");
      setNotes("");
    }
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Debt name is required.");
      return;
    }

    const b = parseNonNegative(balance);
    if (!b.ok) {
      setFormError(`Balance: ${b.message}`);
      return;
    }
    const a = parseNonNegative(apr);
    if (!a.ok) {
      setFormError(`APR: ${a.message}`);
      return;
    }
    const m = parseNonNegative(minimumPayment);
    if (!m.ok) {
      setFormError(`Minimum payment: ${m.message}`);
      return;
    }

    const dueTrim = dueDay.trim();
    let dueNum: number | null = null;
    if (dueTrim !== "") {
      const d = Math.floor(Number(dueTrim));
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        setFormError("Due day must be between 1 and 31, or leave blank.");
        return;
      }
      dueNum = d;
    }

    const cl = parseOptionalNonNegative(creditLimit);
    if (!cl.ok) {
      setFormError(`Credit limit: ${cl.message}`);
      return;
    }

    onSubmit({
      name: trimmedName,
      debt_type: debtType,
      balance: b.value,
      apr: a.value,
      minimum_payment: m.value,
      due_day: dueNum,
      credit_limit: cl.value != null && cl.value > 0 ? cl.value : null,
      lender: lender.trim() || null,
      notes: notes.trim() || null,
    });
  }

  const title = mode === "add" ? "Add debt" : "Edit debt";

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center overflow-y-auto overflow-x-hidden p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="debt-form-title"
    >
      <button
        type="button"
        className="fixed inset-0 z-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 my-auto w-full max-w-lg max-h-[min(92vh,92dvh)] min-h-0 overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#0b1220]/98 p-6 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.85)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Debt tracker
            </p>
            <h2 id="debt-form-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-50">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass} htmlFor="debt-name">
              Debt name <span className="text-rose-400">*</span>
            </label>
            <input
              id="debt-name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chase Sapphire"
              autoComplete="off"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="debt-type">
              Debt type
            </label>
            <select
              id="debt-type"
              className={`${inputClass} cursor-pointer`}
              value={debtType}
              onChange={(e) => setDebtType(e.target.value as DebtType)}
            >
              {DEBT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEBT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="debt-balance">
                Current balance
              </label>
              <input
                id="debt-balance"
                inputMode="decimal"
                className={inputClass}
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="debt-apr">
                APR (%)
              </label>
              <input
                id="debt-apr"
                inputMode="decimal"
                className={inputClass}
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="debt-min">
                Minimum payment
              </label>
              <input
                id="debt-min"
                inputMode="decimal"
                className={inputClass}
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="debt-due">
                Due day (1–31)
              </label>
              <input
                id="debt-due"
                inputMode="numeric"
                className={inputClass}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="debt-limit">
              Credit limit (optional)
            </label>
            <input
              id="debt-limit"
              inputMode="decimal"
              className={inputClass}
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="For utilization on cards"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="debt-lender">
              Lender (optional)
            </label>
            <input
              id="debt-lender"
              className={inputClass}
              value={lender}
              onChange={(e) => setLender(e.target.value)}
              placeholder="Bank or servicer"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="debt-notes">
              Notes (optional)
            </label>
            <textarea
              id="debt-notes"
              rows={3}
              className={`${inputClass} resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Account notes, promo rate end date, etc."
            />
          </div>

          {(formError || submitError) ? (
            <div className="space-y-2">
              {formError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/95">
                  {formError}
                </p>
              ) : null}
              {submitError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200/95">
                  {submitError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "add" ? "Add debt" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
