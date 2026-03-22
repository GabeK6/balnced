-- One-time checks (run in Supabase SQL Editor as postgres or dashboard owner).
-- Confirms table, columns, RPC, and RLS policies for user_plan / fetchUserPlanAccess.

-- 1) Table exists
select to_regclass('public.user_plans') as user_plans_table;

-- 2) Columns expected by app (select list in lib/plan-access.ts)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_plans'
order by ordinal_position;

-- Expected: user_id, plan, updated_at, subscription_status, trial_started_at, trial_ends_at,
-- stripe_customer_id, stripe_subscription_id
-- Note: there is no created_at in current migrations; do not select it unless you add a column.

-- 3) RPC (no arguments; returns void; called as supabase.rpc("ensure_user_plan"))
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid) as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_user_plan';

-- 4) Grants on RPC (authenticated must have EXECUTE)
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'ensure_user_plan';

-- 5) RLS policies on user_plans
select polname, cmd, qual::text as using_expr, with_check::text as with_check_expr
from pg_policies
where schemaname = 'public'
  and tablename = 'user_plans';

-- 6) If PostgREST says "schema cache" / function not found: Dashboard → Project Settings → API → Reload schema cache
--    or redeploy migrations so public.ensure_user_plan exists before the client calls it.
