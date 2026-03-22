-- Per-user subscription tier for feature gating (billing integration is separate).
create table if not exists public.user_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  updated_at timestamptz not null default now()
);

create index if not exists user_plans_plan_idx on public.user_plans (plan);

alter table public.user_plans enable row level security;

create policy "user_plans_select_own"
  on public.user_plans for select
  using (auth.uid() = user_id);

create policy "user_plans_insert_own"
  on public.user_plans for insert
  with check (auth.uid() = user_id);

create policy "user_plans_update_own"
  on public.user_plans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
