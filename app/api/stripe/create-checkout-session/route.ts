import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { logStripeCheckoutConfigSnapshot } from "@/lib/stripe-checkout-diagnostics";
import { getStripeProMonthlyPriceIdOrNull } from "@/lib/stripe-pro-monthly-price";
import { getStripe, isStripeSecretKeyConfigured } from "@/lib/stripe-server";
import { createSupabaseUserClient } from "@/lib/supabase-route-user";

export const runtime = "nodejs";

type ErrorBody = { error: string; message: string };

const USER_SAFE =
  "Checkout is temporarily unavailable. Please try again later.";

function configErrorResponse(error: string, status: number) {
  return NextResponse.json<ErrorBody>(
    { error, message: USER_SAFE },
    { status }
  );
}

/**
 * POST — create a Stripe Checkout Session (subscription mode) for Balnced Pro monthly.
 *
 * Auth: `Authorization: Bearer <supabase access_token>` from the browser session.
 * Uses the anon key + user JWT (not the service role). `stripe_customer_id` is persisted
 * via `set_stripe_customer_id` (SECURITY DEFINER) so updates do not depend on RLS quirks.
 */
export async function POST(req: Request) {
  const priceId = getStripeProMonthlyPriceIdOrNull();
  if (!priceId) {
    logStripeCheckoutConfigSnapshot("stripe_price_missing");
    return configErrorResponse("stripe_price_missing", 503);
  }

  if (!isStripeSecretKeyConfigured()) {
    logStripeCheckoutConfigSnapshot("stripe_secret_missing");
    return configErrorResponse("stripe_secret_missing", 503);
  }

  const stripe = getStripe();

  const authHeader = req.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) {
    return NextResponse.json<ErrorBody>(
      { error: "missing_auth", message: "Authorization required." },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    logStripeCheckoutConfigSnapshot("supabase_env_missing");
    return configErrorResponse("server_misconfigured", 503);
  }

  const supabase = createSupabaseUserClient(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json<ErrorBody>(
      { error: "invalid_session", message: "Invalid or expired session." },
      { status: 401 }
    );
  }

  let baseUrl: string;
  try {
    baseUrl = getAppBaseUrl();
  } catch {
    logStripeCheckoutConfigSnapshot("app_url_missing");
    return configErrorResponse("app_url_missing", 503);
  }

  const { data: ensuredRow, error: rpcError } = await supabase.rpc("ensure_user_plan");

  if (rpcError) {
    console.error("ensure_user_plan:", rpcError);
    logStripeCheckoutConfigSnapshot("ensure_user_plan_rpc_failed");
    return NextResponse.json<ErrorBody>(
      { error: "plan_ensure_failed", message: USER_SAFE },
      { status: 503 }
    );
  }

  if (!ensuredRow || typeof ensuredRow !== "object") {
    console.error("ensure_user_plan returned no row");
    return NextResponse.json<ErrorBody>(
      { error: "plan_lookup_failed", message: USER_SAFE },
      { status: 500 }
    );
  }

  const planPayload = ensuredRow as { stripe_customer_id?: string | null };
  let customerId =
    typeof planPayload.stripe_customer_id === "string"
      ? planPayload.stripe_customer_id.trim() || null
      : null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: {
        supabase_user_id: user.id,
        app: "balnced",
      },
    });
    customerId = customer.id;

    const { error: saveError } = await supabase.rpc("set_stripe_customer_id", {
      p_customer_id: customerId,
    });

    if (saveError) {
      console.error("set_stripe_customer_id:", saveError);
      return NextResponse.json<ErrorBody>(
        { error: "customer_save_failed", message: USER_SAFE },
        { status: 500 }
      );
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/subscription?checkout=success`,
      cancel_url: `${baseUrl}/subscription?checkout=cancel`,
      metadata: {
        supabase_user_id: user.id,
        app: "balnced",
        plan: "pro",
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          app: "balnced",
          plan: "pro",
        },
      },
    });

    if (!session.url) {
      logStripeCheckoutConfigSnapshot("checkout_no_url");
      return NextResponse.json<ErrorBody>(
        { error: "checkout_no_url", message: USER_SAFE },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe.checkout.sessions.create:", e);
    logStripeCheckoutConfigSnapshot("stripe_api_error");
    const message = e instanceof Error ? e.message : "Stripe checkout failed.";
    console.error("[balnced] Stripe API error detail (server only):", message);
    return NextResponse.json<ErrorBody>(
      { error: "stripe_error", message: USER_SAFE },
      { status: 502 }
    );
  }
}
