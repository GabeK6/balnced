/** Matches `public.debts.debt_type` check constraints in app layer. */
export const DEBT_TYPES = [
  "credit_card",
  "auto_loan",
  "student_loan",
  "personal_loan",
  "medical",
  "other",
] as const;

export type DebtType = (typeof DEBT_TYPES)[number];

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit card",
  auto_loan: "Auto loan",
  student_loan: "Student loan",
  personal_loan: "Personal loan",
  medical: "Medical",
  other: "Other",
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  debt_type: DebtType | string;
  balance: number;
  apr: number;
  minimum_payment: number;
  due_day: number | null;
  credit_limit: number | null;
  lender: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function isDebtType(v: string): v is DebtType {
  return (DEBT_TYPES as readonly string[]).includes(v);
}

export function normalizeDebtType(v: unknown): DebtType {
  const s = typeof v === "string" ? v.trim() : "";
  return isDebtType(s) ? s : "other";
}

export function debtFromRow(row: Record<string, unknown>): Debt {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    name: String(row.name ?? "").trim(),
    debt_type: normalizeDebtType(row.debt_type),
    balance: Math.max(0, Number(row.balance ?? 0)),
    apr: Math.max(0, Number(row.apr ?? 0)),
    minimum_payment: Math.max(0, Number(row.minimum_payment ?? 0)),
    due_day: (() => {
      if (row.due_day === null || row.due_day === undefined || row.due_day === "") return null;
      const n = Math.floor(Number(row.due_day));
      if (!Number.isFinite(n) || n < 1 || n > 31) return null;
      return n;
    })(),
    credit_limit:
      row.credit_limit === null || row.credit_limit === undefined || row.credit_limit === ""
        ? null
        : Math.max(0, Number(row.credit_limit)),
    lender:
      row.lender === null || row.lender === undefined
        ? null
        : String(row.lender).trim() || null,
    notes:
      row.notes === null || row.notes === undefined
        ? null
        : String(row.notes).trim() || null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export type DebtInsertPayload = {
  user_id: string;
  name: string;
  debt_type: DebtType;
  balance: number;
  apr: number;
  minimum_payment: number;
  due_day: number | null;
  credit_limit: number | null;
  lender: string | null;
  notes: string | null;
};

export type DebtUpdatePayload = Omit<DebtInsertPayload, "user_id">;
