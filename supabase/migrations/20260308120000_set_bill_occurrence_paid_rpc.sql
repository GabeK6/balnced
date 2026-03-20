-- Reliable "mark recurring bill paid" regardless of PostgREST date filters / RLS RETURNING.
-- SECURITY DEFINER: must ONLY touch rows for auth.uid().

alter table public.bills
  add column if not exists is_paid boolean default false;

create or replace function public.set_bill_occurrence_paid(
  p_recurring_bill_id text,
  p_due_date text,
  p_paid boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  d text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  d := left(trim(p_due_date), 10);

  -- Avoid coalesce(text, boolean): archived / params may be text in some DBs.
  update public.bills b
  set is_paid = coalesce(p_paid::boolean, false)
  where b.user_id = auth.uid()
    and b.recurring_bill_id::text = trim(p_recurring_bill_id)
    and coalesce(b.archived::boolean, false) = false
    and left(b.due_date::text, 10) = d;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.set_bill_occurrence_paid(text, text, boolean) from public;
grant execute on function public.set_bill_occurrence_paid(text, text, boolean) to authenticated;
grant execute on function public.set_bill_occurrence_paid(text, text, boolean) to service_role;

comment on function public.set_bill_occurrence_paid is
  'Sets is_paid for all bills matching user, recurring template, and calendar due date (YYYY-MM-DD).';
