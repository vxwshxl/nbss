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
