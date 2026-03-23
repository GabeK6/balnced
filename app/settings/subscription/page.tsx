import SubscriptionPageClient from "./subscription-page-client";
import { isStripeCheckoutPriceConfigured } from "@/lib/stripe-pro-monthly-price";

/** Read `STRIPE_PRICE_PRO_MONTHLY` on each request (not at static build time). */
export const dynamic = "force-dynamic";

/**
 * Server Component: reads Stripe price env on the server only (never in the client bundle).
 */
export default function SubscriptionPage() {
  const hasStripePriceConfigured = isStripeCheckoutPriceConfigured();

  return <SubscriptionPageClient hasStripePriceConfigured={hasStripePriceConfigured} />;
}
