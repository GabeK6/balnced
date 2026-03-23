import { handleStripeWebhookRequest } from "@/lib/stripe-webhook-handler";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook
 *
 * Stripe sends the raw JSON body; signature verification requires the untouched body bytes.
 * Do not parse JSON before `constructEvent`.
 */
export async function POST(req: Request) {
  return handleStripeWebhookRequest(req);
}
