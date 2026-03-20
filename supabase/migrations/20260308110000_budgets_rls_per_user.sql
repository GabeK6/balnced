-- Replace overly permissive budgets RLS (e.g. USING (true)) with per-user access.
-- Requires column public.budgets.user_id (uuid) matching auth.uid().

alter table public.budgets enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'budgets'
  loop
    execute format('drop policy if exists %I on public.budgets', pol.policyname);
  end loop;
end $$;

create policy "budgets_select_own"
  on public.budgets
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "budgets_insert_own"
  on public.budgets
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "budgets_update_own"
  on public.budgets
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "budgets_delete_own"
  on public.budgets
  for delete
  to authenticated
  using (user_id = auth.uid());
