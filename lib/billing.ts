/**
 * Stripe + subscription integration (future).
 *
 * Required env (when enabling billing):
 * - STRIPE_SECRET_KEY — server-only; create Checkout Sessions
 * - STRIPE_WEBHOOK_SECRET — verify `checkout.session.completed`, `customer.subscription.*`
 * - STRIPE_PRICE_PRO — recurring price id for Balnced Pro
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — client Checkout if using Stripe.js
 *
 * Supabase:
 * - `public.user_plans.stripe_customer_id`, `stripe_subscription_id` (see migration)
 * - On successful subscription: set `plan = 'pro'`, `subscription_status = 'active'`
 * - On cancel at period end / deletion: set `subscription_status = 'canceled'` (or `inactive` after grace)
 * - On payment failed: `subscription_status = 'past_due'` (optional grace for access — see plan-access.ts)
 *
 * Webhook handler skeleton: `app/api/webhooks/stripe/route.ts`
 * Checkout skeleton: `app/api/billing/checkout/route.ts`
 */

export const BILLING_CHECKOUT_PATH = "/api/billing/checkout";
