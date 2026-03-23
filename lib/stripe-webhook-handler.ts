import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function stripeRefId(
  ref:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Subscription
    | null
    | undefined
): string | null {
  if (typeof ref === "string" && ref.length > 0) return ref;
  if (ref && typeof ref === "object" && "id" in ref && typeof ref.id === "string") {
    return ref.id;
  }
  return null;
}

function parseUuid(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      t
    )
  ) {
    return t;
  }
  return null;
}

/**
 * checkout.session.completed — set Pro + active subscription on user_plans.
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = stripeRefId(session.customer);
  const subscriptionId = stripeRefId(session.subscription);

  if (!customerId) {
    console.error("[balnced] webhook checkout.session.completed: missing customer id");
    return;
  }

  if (!subscriptionId) {
    console.error(
      "[balnced] webhook checkout.session.completed: missing subscription id (mode subscription expected)"
    );
    return;
  }

  const meta = session.metadata ?? {};
  let userId =
    parseUuid(typeof meta.supabase_user_id === "string" ? meta.supabase_user_id : null) ??
    parseUuid(typeof session.client_reference_id === "string" ? session.client_reference_id : null);

  const supabase = createSupabaseServiceClient();

  if (!userId) {
    const { data: row, error: lookupErr } = await supabase
      .from("user_plans")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (lookupErr) {
      console.error("[balnced] webhook user lookup by stripe_customer_id:", lookupErr);
      return;
    }
    userId = row?.user_id ?? null;
  }

  if (!userId) {
    console.error(
      "[balnced] webhook: cannot resolve Supabase user id (metadata, client_reference_id, or stripe_customer_id)"
    );
    return;
  }

  const { error: updateErr } = await supabase
    .from("user_plans")
    .update({
      plan: "pro",
      subscription_status: "active",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[balnced] webhook user_plans update failed:", updateErr);
    throw new Error(updateErr.message);
  }

  console.log("[balnced] webhook: user_plans updated to pro for user_id=", userId);
}

/**
 * Verifies signature and processes supported Stripe events.
 * Returns a Response for the Route Handler to return.
 */
export async function handleStripeWebhookRequest(req: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("[balnced] webhook: STRIPE_WEBHOOK_SECRET is not set");
    return new Response(JSON.stringify({ error: "webhook_not_configured" }), {
      status: 501,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  if (!rawBody) {
    return new Response(JSON.stringify({ error: "empty_body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "missing_stripe_signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error("[balnced] webhook: signature verification failed:", e);
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleCheckoutSessionCompleted(session);
        } else {
          console.warn(
            "[balnced] webhook: checkout.session.completed ignored (mode is not subscription)"
          );
        }
        break;
      }
      default:
        console.log("[balnced] webhook: unhandled event type:", event.type);
    }
  } catch (e) {
    console.error("[balnced] webhook: handler error:", e);
    return new Response(JSON.stringify({ error: "handler_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
