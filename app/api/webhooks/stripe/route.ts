/**
 * Legacy path — forwards to the canonical Stripe webhook implementation.
 * Prefer configuring Stripe / Stripe CLI to POST `/api/stripe/webhook`.
 */
export { POST } from "../../stripe/webhook/route";
