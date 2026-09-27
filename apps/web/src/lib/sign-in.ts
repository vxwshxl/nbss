import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isValidEmail } from "@nbss/shared/identity";

import { isValidCode, normaliseCode, type Role } from "@/lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * The one door, shared by the website's sign-in form and the app's JSON
 * endpoints, so both admit exactly the same people by exactly the same rules.
 *
 * Every role signs in here. What they type is an email address or an employee
 * code; what proves it is either a six-digit code that Supabase Auth mails
 * through ZeptoMail, or the password / PIN they already hold. Which dashboard
 * they land on is decided afterwards from their profile — never from anything
 * the form sent.
 *
 * The answers are deliberately uniform: an unknown address, a deactivated
 * account and a wrong code all fail the same way, so the form cannot be used to
 * discover who works here.
 */

type Client = SupabaseClient<Database>;

export type SignInResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; error: string };

export const REFUSED = "Those details were not accepted.";
export const BAD_CODE = "That code is invalid or has expired.";

/** The address the login is registered under, or null. Never throws. */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  try {
    const admin = supabaseAdmin();
    let profile: { id: string; active: boolean } | null = null;

    if (raw.includes("@")) {
      if (!isValidEmail(raw)) return null;
      const { data } = await admin
        .from("profiles")
        .select("id, active")
        .eq("email", raw.toLowerCase())
        .maybeSingle();
      profile = data;
    } else {
      const code = normaliseCode(raw);
      if (!isValidCode(code)) return null;
      const { data } = await admin
        .from("profiles")
        .select("id, active")
        .eq("employee_code", code)
        .maybeSingle();
      profile = data;
    }

    if (!profile?.active) return null;
    const { data } = await admin.auth.admin.getUserById(profile.id);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Synthesized logins have no mailbox behind them, so a code is never sent there. */
function deliverable(email: string): boolean {
  return !email.endsWith("@staff.nbss.co.in");
}

/**
 * Mails a sign-in code if the identifier belongs to an active account with a
 * real address. Always reports success, for the reason at the top of the file.
 */
export async function sendSignInCode(identifier: string, client: Client): Promise<void> {
  const email = await resolveLoginEmail(identifier);
  if (!email || !deliverable(email)) return;
  await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
}

async function finish(client: Client, userId: string | undefined): Promise<SignInResult> {
  if (!userId) return { ok: false, error: REFUSED };
  const { data: profile } = await client
    .from("profiles")
    .select("role, active")
    .eq("id", userId)
    .maybeSingle();

  // Signed in, but no usable profile — treat it as a failure rather than
  // dropping someone into a console with no role.
  if (!profile || !profile.active) {
    await client.auth.signOut();
    return { ok: false, error: REFUSED };
  }
  return { ok: true, userId, role: profile.role };
}

export async function verifySignInCode(
  identifier: string,
  code: string,
  client: Client,
): Promise<SignInResult> {
  const token = code.replace(/\D/g, "");
  if (token.length !== 6) return { ok: false, error: BAD_CODE };

  const email = await resolveLoginEmail(identifier);
  if (!email) return { ok: false, error: BAD_CODE };

  const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false, error: BAD_CODE };
  return finish(client, data.user?.id);
}

export async function passwordSignIn(
  identifier: string,
  secret: string,
  client: Client,
): Promise<SignInResult> {
  if (!secret) return { ok: false, error: REFUSED };
  const email = await resolveLoginEmail(identifier);
  if (!email) return { ok: false, error: REFUSED };

  const { data, error } = await client.auth.signInWithPassword({ email, password: secret });
  if (error) return { ok: false, error: REFUSED };
  return finish(client, data.user?.id);
}

/**
 * A client that keeps its session in memory only, for the app's endpoints: it
 * signs in, hands the tokens back to the phone, and is thrown away. The phone
 * then holds the session in its own encrypted store.
 */
export function statelessClient(): Client {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

// ------------------------------------------------------------------ throttle
/**
 * Failed attempts per key (source address, and separately the identifier).
 *
 * In-process, so per instance — a speed bump rather than the boundary. The
 * boundary is Supabase Auth's own verification limits and a code that expires
 * in ten minutes; this stops a script trying a million codes from one place.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isThrottled(...keys: string[]): boolean {
  const now = Date.now();
  return keys.some((key) => {
    const r = attempts.get(key);
    return !!r && now - r.first < WINDOW_MS && r.count >= MAX_ATTEMPTS;
  });
}

export function recordFailure(...keys: string[]): void {
  const now = Date.now();
  for (const key of keys) {
    const r = attempts.get(key);
    if (!r || now - r.first > WINDOW_MS) attempts.set(key, { count: 1, first: now });
    else r.count += 1;
  }
}

export function clearFailures(...keys: string[]): void {
  for (const key of keys) attempts.delete(key);
}

export const THROTTLED = "Too many attempts. Wait ten minutes and try again.";
