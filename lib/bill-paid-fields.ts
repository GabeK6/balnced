/**
 * PostgREST payloads for `public.bills` paid state.
 * Requires migrations: `is_paid` (boolean), `paid_at` (timestamptz nullable).
 */
export function billPaidFields(paid: boolean): {
  is_paid: boolean;
  paid_at: string | null;
} {
  return {
    is_paid: paid,
    paid_at: paid ? new Date().toISOString() : null,
  };
}
