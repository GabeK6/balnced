-- Fix missing / mismatched ensure_user_plan RPC and RLS for public.user_plans.
--
-- Apply via: supabase db push / migration pipeline, OR paste the full file into
-- Supabase Dashboard → SQL Editor → Run (same effect).

grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Drop every overload of ensure_user_plan (PostgREST requires an exact match)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as proc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'ensure_user_plan'
      and n.nspname = 'public'
  loop
    execute 'drop function if exists ' || r.proc || ' cascade';
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Table privileges (RLS still applies; authenticated must have DML rights)
-- ---------------------------------------------------------------------------
revoke all on table public.user_plans from public;
grant select, insert, update on table public.user_plans to authenticated;
grant all on table public.user_plans to service_role;

-- user_id is already the primary key (unique). No extra unique constraint needed.

-- ---------------------------------------------------------------------------
-- 3) RLS policies (tight; only own row)
-- ---------------------------------------------------------------------------
alter table public.user_plans enable row level security;

drop policy if exists "user_plans_select_own" on public.user_plans;
drop policy if exists "user_plans_insert_own" on public.user_plans;
drop policy if exists "user_plans_update_own" on public.user_plans;

create policy "user_plans_select_own"
  on public.user_plans
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_plans_insert_own"
  on public.user_plans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_plans_update_own"
  on public.user_plans
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) ensure_user_plan: security definer, insert default row, return full row
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_plan()
returns public.user_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.user_plans;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.user_plans
  set subscription_status = 'inactive'
  where user_id = uid
    and subscription_status = 'trialing'
    and trial_ends_at is not null
    and trial_ends_at <= now();

  insert into public.user_plans (user_id, plan, subscription_status, trial_started_at, trial_ends_at)
  values (uid, 'free', 'trialing', now(), now() + interval '7 days')
  on conflict (user_id) do nothing;

  update public.user_plans
  set
    subscription_status = 'trialing',
    trial_started_at = now(),
    trial_ends_at = now() + interval '7 days'
  where user_id = uid
    and plan = 'free'
    and trial_started_at is null;

  select * into strict result
  from public.user_plans
  where user_id = uid;

  return result;
end;
$$;

comment on function public.ensure_user_plan() is
  'Ensures a user_plans row exists (default free + trial), applies trial expiry rules, returns the row.';

revoke all on function public.ensure_user_plan() from public;
grant execute on function public.ensure_user_plan() to authenticated;
grant execute on function public.ensure_user_plan() to service_role;
