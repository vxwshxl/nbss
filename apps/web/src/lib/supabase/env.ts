/**
 * The Supabase connection details, read once and validated loudly.
 *
 * Every public value is referenced as a literal `process.env.NEXT_PUBLIC_…`
 * expression, never through a computed key. Next inlines these at build time
 * by matching the source text, so `process.env[name]` would survive into the
 * browser bundle as a lookup against an object that is not there — the value
 * would simply be undefined at run time. The repetition below is the point.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy it from the Supabase dashboard (Settings → API Keys) into .env.`,
    );
  }
  return value;
}

/** Safe in the browser: every request it makes is still subject to RLS. */
export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Server-only. This key bypasses row level security entirely, so it must never
 * reach a client bundle. It is read inside a function rather than at module
 * scope so that importing this file from a client component does not pull the
 * value into the bundle — and because it carries no NEXT_PUBLIC_ prefix, Next
 * would refuse to inline it there in any case.
 */
export function secretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}

/**
 * How long the session cookie lives: a year. A guard should sign in once on
 * their phone and stay signed in until they sign out or clear the browser's
 * data — the refresh token behind it does not expire on its own (Auth has no
 * session timebox or inactivity timeout; see scripts/configure-auth.mjs).
 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Where the server reaches the database. On the production box Supabase runs on the same
 * machine, so SUPABASE_INTERNAL_URL points at its local gateway (about 2 ms a call)
 * instead of the public URL, which leaves the box through Cloudflare and comes back
 * (about 430 ms a call, several per page). Browsers always use the public URL.
 */
export function serverSupabaseUrl(): string {
  return process.env.SUPABASE_INTERNAL_URL?.trim() || SUPABASE_URL;
}

/**
 * The session cookie's name, fixed from the public URL. Supabase names it after the
 * host it is given, so a server client on the internal URL would otherwise look for a
 * different cookie than the browser wrote and find nobody signed in.
 */
export const AUTH_COOKIE_NAME = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
