import { supabase } from "@/lib/supabase";

export type CheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const USER_SAFE_CHECKOUT =
  "Checkout is temporarily unavailable. Please try again in a moment.";

/**
 * Starts a Stripe Checkout Session for Balnced Pro (monthly) and returns the hosted URL.
 * Plan changes are applied only after webhook sync — this only opens payment.
 */
export async function createCheckoutSessionForPro(): Promise<CheckoutSessionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return { ok: false, error: "You must be signed in to subscribe." };
  }

  const res = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await res.json().catch(() => ({}))) as {
    url?: unknown;
    error?: unknown;
    message?: unknown;
  };

  if (!res.ok) {
    if (res.status === 401) {
      const msg =
        typeof data.message === "string" ? data.message : "Invalid or expired session.";
      return { ok: false, error: msg };
    }
    return { ok: false, error: USER_SAFE_CHECKOUT };
  }

  const url = typeof data.url === "string" ? data.url : null;
  if (!url) {
    return { ok: false, error: USER_SAFE_CHECKOUT };
  }

  return { ok: true, url };
}
