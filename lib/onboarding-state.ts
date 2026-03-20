/**
 * Client-only flag: user finished the first-run onboarding wizard.
 * Legacy users with an existing budget are migrated on first visit to /onboarding.
 */

const key = (userId: string) => `balnced_onboarding_v1_${userId}`;

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(userId), "1");
  } catch {
    // ignore
  }
}
