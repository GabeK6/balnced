import "server-only";
import Stripe from "stripe";
import { loadEnvConfig } from "@next/env";

/**
 * Resolve Stripe secret key from process.env + combined env (same loader as `.env.local`).
 * Mirrors the pattern in `stripe-pro-monthly-price.ts` so Turbopack does not drop server secrets.
 */
function resolveStripeSecretKey(): string | undefined {
  const dev = process.env.NODE_ENV !== "production";
  const { combinedEnv } = loadEnvConfig(process.cwd(), dev);
  const fromProcess = process.env.STRIPE_SECRET_KEY;
  const fromCombined = combinedEnv.STRIPE_SECRET_KEY;
  const pick =
    typeof fromProcess === "string" && fromProcess.trim() !== ""
      ? fromProcess
      : typeof fromCombined === "string" && fromCombined.trim() !== ""
        ? fromCombined
        : undefined;
  return pick?.trim();
}

/**
 * Singleton Stripe client for server-side API routes (Checkout, webhooks, etc.).
 */
let stripe: Stripe | null = null;

export function isStripeSecretKeyConfigured(): boolean {
  return !!resolveStripeSecretKey();
}

export function getStripe(): Stripe {
  const key = resolveStripeSecretKey();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripe) {
    stripe = new Stripe(key, {
      typescript: true,
    });
  }
  return stripe;
}
