/**
 * Draft onboarding answers — survives refresh; cleared when setup completes.
 */

const DRAFT_KEY = (userId: string) => `balnced_onboarding_draft_v1_${userId}`;

export type BillDraft = { id: string; name: string; amount: string; due: string };

export type OnboardingDraftV1 = {
  version: 1;
  step: number;
  balance: string;
  payType: "salary" | "hourly";
  payFrequency: "weekly" | "biweekly" | "twice_monthly" | "monthly";
  paycheck: string;
  hourlyRate: string;
  hoursWorked: string;
  nextPayday: string;
  billRows: BillDraft[];
  goalName: string;
  goalAmount: string;
  savePercent: string;
};

export function loadOnboardingDraft(userId: string): OnboardingDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraftV1;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(userId: string, draft: OnboardingDraftV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY(userId), JSON.stringify(draft));
  } catch {
    // ignore quota
  }
}

export function clearOnboardingDraft(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY(userId));
  } catch {
    // ignore
  }
}
