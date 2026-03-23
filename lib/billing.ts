/**
 * Stripe + subscription integration (future).
 *
 * Required env (when enabling billing):
 * - STRIPE_SECRET_KEY — server-only; required for Stripe API (Checkout Sessions)
 * - STRIPE_WEBHOOK_SECRET — verify signatures on `POST /api/stripe/webhook`
 * - SUPABASE_SERVICE_ROLE_KEY — server-only; updates `user_plans` from webhooks (bypasses RLS)
 * - STRIPE_PRICE_PRO_MONTHLY — recurring price id for Balnced Pro (Checkout subscription mode)
 * - NEXT_PUBLIC_APP_URL — origin for Stripe success/cancel redirects
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — reserved for Stripe.js / Payment Element (redirect Checkout does not require it)
 *
 * Supabase:
 * - `public.user_plans.stripe_customer_id`, `stripe_subscription_id` (see migration)
 * - On successful subscription: set `plan = 'pro'`, `subscription_status = 'active'`
 * - On cancel at period end / deletion: set `subscription_status = 'canceled'` (or `inactive` after grace)
 * - On payment failed: `subscription_status = 'past_due'` (optional grace for access — see plan-access.ts)
 *
 * Webhook handler skeleton: `app/api/webhooks/stripe/route.ts`
 * Checkout session: `POST app/api/stripe/create-checkout-session/route.ts`
 */

export const BILLING_CHECKOUT_PATH = "/api/stripe/create-checkout-session";
