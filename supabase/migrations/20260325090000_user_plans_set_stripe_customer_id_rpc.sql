-- Secure billing field update: SECURITY DEFINER RPC scoped to auth.uid().
-- Avoids RLS edge cases with PostgREST + Bearer on direct .from().update().

create or replace function public.set_stripe_customer_id(p_customer_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_customer_id is null or length(trim(p_customer_id)) = 0 then
    raise exception 'Invalid customer id';
  end if;

  update public.user_plans
  set
    stripe_customer_id = trim(p_customer_id),
    updated_at = now()
  where user_id = uid;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'user_plans row missing for user';
  end if;
end;
$$;

comment on function public.set_stripe_customer_id(text) is
  'Sets Stripe customer id for the current user only (auth.uid()). RLS-safe via SECURITY DEFINER.';

revoke all on function public.set_stripe_customer_id(text) from public;
grant execute on function public.set_stripe_customer_id(text) to authenticated;
grant execute on function public.set_stripe_customer_id(text) to service_role;
