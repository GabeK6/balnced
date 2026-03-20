-- App expects a boolean paid flag on ledger bill rows.
alter table public.bills
  add column if not exists is_paid boolean default false;

comment on column public.bills.is_paid is 'When true, this occurrence is treated as paid in Bills UI and cash-flow math.';
