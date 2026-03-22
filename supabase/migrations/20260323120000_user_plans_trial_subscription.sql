-- Trial + subscription lifecycle on public.user_plans (single source of truth).
-- Effective Pro access (app + API): trialing with trial_ends_at > now(), or paid pro (active/past_due).

alter table public.user_plans
  add column if not exists subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled'));

alter table public.user_plans
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

alter table public.user_plans
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- One-time: existing free accounts get a 7-day trial window from migration time (trial_started_at was null).
update public.user_plans
set
  subscription_status = 'trialing',
  trial_started_at = now(),
  trial_ends_at = now() + interval '7 days'
where plan = 'free'
  and trial_started_at is null;

-- Existing Pro flag (manual / pre-billing): treat as active paid.
update public.user_plans
set subscription_status = 'active'
where plan = 'pro'
  and subscription_status = 'inactive';

-- Expire trial, create missing row, or grant legacy trial once (trial_started_at still null).
create or replace function public.ensure_user_plan()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
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
end;
$$;

grant execute on function public.ensure_user_plan() to authenticated;

-- New auth users: start 7-day Pro trial automatically.
create or replace function public.handle_new_user_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plans (user_id, plan, subscription_status, trial_started_at, trial_ends_at)
  values (new.id, 'free', 'trialing', now(), now() + interval '7 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_user_plan on auth.users;

create trigger on_auth_user_created_user_plan
  after insert on auth.users
  for each row execute procedure public.handle_new_user_plan();

comment on function public.ensure_user_plan is
  'Expires trials, ensures a user_plans row exists, and grants one-time trial if legacy row had no trial_started_at.';
comment on function public.handle_new_user_plan is
  'Inserts default trialing user_plans row for new auth.users (idempotent on conflict).';
