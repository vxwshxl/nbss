import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, secretKey } from "./env";
import type { Database } from "./types";

/**
 * Two clients, and the difference between them matters.
 *
 * `supabaseServer()` acts as the signed-in person: it carries their session
 * cookie, so every query it makes is filtered by the row level security
 * policies in 0001_foundation.sql. This is the default, and what page and
 * action code should reach for.
 *
 * `supabaseAdmin()` acts as the database owner and bypasses those policies
 * completely. It exists for the handful of operations that legitimately need
 * it — creating a guard's login, resolving an employee code to an account
 * before anyone is signed in, writing the audit log. Reach for it only when
 * the operation genuinely cannot be done as the signed-in user, and never in
 * response to unvalidated input.
 */

export async function supabaseServer() {
  const store = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session on every request, so nothing is
          // lost by letting this pass silently.
        }
      },
    },
  });
}

/** Bypasses RLS. Never call this with input that has not been checked first. */
export function supabaseAdmin() {
  return createClient<Database>(SUPABASE_URL, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
