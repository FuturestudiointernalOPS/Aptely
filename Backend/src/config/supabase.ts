import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * supabaseAdmin — uses service_role key.
 * Has full access to the database, bypasses RLS.
 * Use ONLY in server-side code for admin operations.
 * 
 * Timeout: 30s (increased from default 10s) to handle slow Supabase connections
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: (url, init) =>
      fetch(url, {
        ...init,
        signal: AbortSignal.timeout(30 * 1000), // 30 second timeout
      }),
  },
});

/**
 * createUserClient — factory that returns a fresh, stateless Supabase client.
 *
 * WHY: supabaseAdmin is a singleton. Calling .auth.signInWithPassword() on it
 * stores the user session in memory, causing subsequent .from() calls to use
 * the user JWT instead of the service_role key → RLS violations in tests.
 *
 * Use this factory for any auth operation that returns user tokens
 * (signInWithPassword, refreshSession) so the shared admin client stays clean.
 */
export const createUserClient = () =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          signal: AbortSignal.timeout(30 * 1000),
        }),
    },
  });

/**
 * createAuthenticatedClient — per-request factory that injects the user's JWT
 * into every outgoing fetch via the Authorization header.
 * This causes Supabase to enforce RLS policies for the authenticated user.
 * Use this instead of supabaseAdmin for all user-context data operations.
 */
export const createAuthenticatedClient = (accessToken: string) =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          signal: AbortSignal.timeout(30 * 1000),
        }),
    },
  });
