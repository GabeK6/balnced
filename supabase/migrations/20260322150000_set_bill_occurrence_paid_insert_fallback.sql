-- Fix: mark-paid for a recurring occurrence must persist when no ledger row existed yet
-- (UPDATE matched 0 rows). Insert a paid ledger row from the template.
-- Also set paid_at when marking paid.

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
  n int := 0;
  ins int := 0;
  d text;
  uid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  uid := auth.uid();
  d := left(trim(p_due_date), 10);

  update public.bills b
  set
    is_paid = coalesce(p_paid::boolean, false),
    paid_at = case when coalesce(p_paid::boolean, false) then now() else null end
  where b.user_id = uid
    and b.recurring_bill_id::text = trim(p_recurring_bill_id)
    and coalesce(b.archived::boolean, false) = false
    and left(b.due_date::text, 10) = d;

  get diagnostics n = row_count;

  -- No matching row: materialize one from the template (same as app insert fallback).
  if n = 0 and coalesce(p_paid::boolean, false) = true then
    insert into public.bills (
      user_id,
      name,
      amount,
      due_date,
      is_paid,
      archived,
      recurring_bill_id,
      is_recurring,
      paid_at
    )
    select
      uid,
      rb.name,
      coalesce(rb.amount::numeric, 0),
      d::date,
      true,
      false,
      rb.id,
      true,
      now()
    from public.recurring_bills rb
    where rb.user_id = uid
      and rb.id::text = trim(p_recurring_bill_id)
      and coalesce(rb.active::boolean, true) = true
      and not exists (
        select 1
        from public.bills b
        where b.user_id = uid
          and b.recurring_bill_id::text = trim(p_recurring_bill_id)
          and coalesce(b.archived::boolean, false) = false
          and left(b.due_date::text, 10) = d
      );

    get diagnostics ins = row_count;
  end if;

  return n + ins;
end;
$$;

comment on function public.set_bill_occurrence_paid is
  'Sets is_paid for bills matching user, recurring template, and calendar due date; inserts a paid row if none existed.';
