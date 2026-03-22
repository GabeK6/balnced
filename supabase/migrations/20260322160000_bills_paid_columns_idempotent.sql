-- Idempotent: safe on empty DBs and on projects that already ran older migrations.
-- Run this (or `supabase db push`) if mark-paid fails or PostgREST omits is_paid.

alter table public.bills add column if not exists is_paid boolean default false;

update public.bills set is_paid = false where is_paid is null;

alter table public.bills add column if not exists paid_at timestamptz null;

comment on column public.bills.is_paid is
  'When true, this ledger row is treated as paid in Bills UI and cash-flow math.';
comment on column public.bills.paid_at is
  'When set, time the bill was marked paid (optional; RPC and client may both write this).';
