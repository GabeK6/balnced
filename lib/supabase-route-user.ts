import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client for Route Handlers when the browser sends `Authorization: Bearer <access_token>`.
 * The token is the logged-in user's JWT; PostgREST uses it for `auth.uid()` / RLS.
 *
 * For cookie-based SSR, use `@supabase/ssr` `createServerClient` instead — this app’s
 * checkout flow passes the access token explicitly from `supabase.auth.getSession()`.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key is not configured.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
