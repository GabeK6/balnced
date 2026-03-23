import "server-only";
import { loadEnvConfig } from "@next/env";

/**
 * Balnced Pro monthly Stripe Price ID — server-only, never `NEXT_PUBLIC_`.
 *
 * We call `loadEnvConfig` from `@next/env` (same loader Next uses) so values from
 * `.env.local` are applied even when Turbopack would otherwise treat
 * `process.env.STRIPE_PRICE_PRO_MONTHLY` as a compile-time replacement.
 */
function resolveStripeProMonthlyRaw(): string | undefined {
  const dev = process.env.NODE_ENV !== "production";
  const { combinedEnv } = loadEnvConfig(process.cwd(), dev);

  // Prefer explicit `process.env` read (required contract) after loader ran.
  const fromProcess = process.env.STRIPE_PRICE_PRO_MONTHLY;
  const fromCombined = combinedEnv.STRIPE_PRICE_PRO_MONTHLY;

  const pick =
    typeof fromProcess === "string" && fromProcess.trim() !== ""
      ? fromProcess
      : typeof fromCombined === "string" && fromCombined.trim() !== ""
        ? fromCombined
        : undefined;

  return normalizeEnvValue(pick);
}

/**
 * Normalize values from `.env` (trim, strip optional surrounding quotes).
 */
function normalizeEnvValue(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  let s = raw.trim();
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s[s.length - 1] === q) {
      s = s.slice(1, -1).trim();
    }
  }
  return s.length > 0 ? s : undefined;
}

/**
 * Read Balnced Pro monthly Stripe Price ID from the **server** environment only.
 */
export function getStripeProMonthlyPriceIdOrNull(): string | null {
  const raw = resolveStripeProMonthlyRaw();
  return raw ?? null;
}

export function isStripeCheckoutPriceConfigured(): boolean {
  return getStripeProMonthlyPriceIdOrNull() !== null;
}
