/**
 * Base origin for Supabase auth email links (`redirectTo`).
 * Prefer `NEXT_PUBLIC_APP_URL` in deployed environments; fall back to
 * `window.location.origin` in the browser when unset (typical local dev).
 */
export function getAuthRedirectBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (raw) return raw.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
