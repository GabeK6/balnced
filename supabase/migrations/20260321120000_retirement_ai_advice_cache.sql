-- Cache OpenAI retirement coaching per user; invalidate when input hash changes.

create table if not exists public.retirement_ai_advice_cache (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  input_hash text not null,
  insights jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists retirement_ai_advice_cache_user_id_idx
  on public.retirement_ai_advice_cache (user_id);

alter table public.retirement_ai_advice_cache enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'retirement_ai_advice_cache'
  loop
    execute format('drop policy if exists %I on public.retirement_ai_advice_cache', pol.policyname);
  end loop;
end $$;

create policy "retirement_ai_advice_cache_select_own"
  on public.retirement_ai_advice_cache
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "retirement_ai_advice_cache_insert_own"
  on public.retirement_ai_advice_cache
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "retirement_ai_advice_cache_update_own"
  on public.retirement_ai_advice_cache
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "retirement_ai_advice_cache_delete_own"
  on public.retirement_ai_advice_cache
  for delete
  to authenticated
  using (user_id = auth.uid());
