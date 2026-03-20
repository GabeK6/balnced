-- Optional: app does not require this column (paid state uses is_paid only).
-- Apply when you want paid_at for reporting or future triggers.
alter table public.bills add column if not exists paid_at timestamptz;

comment on column public.bills.paid_at is 'Optional timestamp when is_paid became true.';
