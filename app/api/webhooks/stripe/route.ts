import { NextResponse } from "next/server";

/**
 * Stripe webhooks — verify signature with STRIPE_WEBHOOK_SECRET, then:
 * - checkout.session.completed → link customer to user_id metadata, set user_plans.plan = pro, subscription_status = active
 * - customer.subscription.updated / deleted → sync subscription_status
 *
 * Use SUPABASE_SERVICE_ROLE_KEY server-side to update `user_plans` (bypass RLS).
 */
export async function POST(req: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 501 });
  }

  const raw = await req.text();
  if (!raw) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  return NextResponse.json(
    {
      received: true,
      note: "Implement Stripe.constructEvent + user_plans updates when enabling billing.",
      bytes: raw.length,
    },
    { status: 200 }
  );
}
