import { NextResponse } from "next/server";

/**
 * POST — create Stripe Checkout Session for Pro subscription.
 * Install `stripe` and set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, success/cancel URLs.
 */
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message:
          "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_PRO, install the stripe package, then implement session creation.",
      },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { error: "not_implemented", message: "Checkout session creation is not wired yet." },
    { status: 501 }
  );
}
