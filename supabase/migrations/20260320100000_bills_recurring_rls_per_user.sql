-- Per-user isolation for bills and recurring bill templates (same pattern as budgets).
-- Requires public.bills.user_id and public.recurring_bills.user_id (uuid) = auth.uid().

alter table public.bills enable row level security;
alter table public.recurring_bills enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'bills'
  loop
    execute format('drop policy if exists %I on public.bills', pol.policyname);
  end loop;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recurring_bills'
  loop
    execute format('drop policy if exists %I on public.recurring_bills', pol.policyname);
  end loop;
end $$;

-- ---- bills ----
create policy "bills_select_own"
  on public.bills
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "bills_insert_own"
  on public.bills
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "bills_update_own"
  on public.bills
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bills_delete_own"
  on public.bills
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---- recurring_bills ----
create policy "recurring_bills_select_own"
  on public.recurring_bills
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "recurring_bills_insert_own"
  on public.recurring_bills
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "recurring_bills_update_own"
  on public.recurring_bills
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recurring_bills_delete_own"
  on public.recurring_bills
  for delete
  to authenticated
  using (user_id = auth.uid());
