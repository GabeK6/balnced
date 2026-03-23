import "server-only";
import { loadEnvConfig } from "@next/env";
import { getStripeProMonthlyPriceIdOrNull } from "@/lib/stripe-pro-monthly-price";
import { isStripeSecretKeyConfigured } from "@/lib/stripe-server";

/**
 * Logs which checkout-related env vars are set vs missing (never logs secret values).
 * Call only on failure paths when configuring Stripe checkout.
 */
export function logStripeCheckoutConfigSnapshot(context: string): void {
  const dev = process.env.NODE_ENV !== "production";
  const { combinedEnv } = loadEnvConfig(process.cwd(), dev);

  const present = (name: string): boolean => {
    const p = process.env[name as keyof NodeJS.ProcessEnv];
    const c = (combinedEnv as Record<string, string | undefined>)[name];
    return (
      (typeof p === "string" && p.trim() !== "") ||
      (typeof c === "string" && c.trim() !== "")
    );
  };

  const publishableOk = present("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

  console.error(
    `[balnced] Stripe checkout config [${context}]`,
    `STRIPE_SECRET_KEY=${isStripeSecretKeyConfigured() ? "set" : "MISSING"}`,
    `STRIPE_PRICE_PRO_MONTHLY=${getStripeProMonthlyPriceIdOrNull() ? "set" : "MISSING"}`,
    `NEXT_PUBLIC_APP_URL=${present("NEXT_PUBLIC_APP_URL") ? "set" : "MISSING"}`,
    `NEXT_PUBLIC_SUPABASE_URL=${present("NEXT_PUBLIC_SUPABASE_URL") ? "set" : "MISSING"}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${present("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "set" : "MISSING"}`,
    `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${publishableOk ? "set" : "not_set"} (optional; not required for server Checkout redirect)`
  );
}
