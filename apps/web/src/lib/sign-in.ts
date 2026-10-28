import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isValidMobile, normaliseName } from "@nbss/shared/identity";

import { homeFor, type Role } from "@/lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, serverSupabaseUrl } from "@/lib/supabase/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * The one door, shared by the website's sign-in form and the app's JSON
 * endpoints, so both admit exactly the same people by exactly the same rules.
 *
 * Everyone who works for NBSS — guards, housekeepers, supervisors, administrators
 * and developers — types their name and their 10-digit mobile number, and is in.
 * Clients sign in with Google (app/auth/callback), not here.
 *
 * Which dashboard someone lands on is decided afterwards from their profile —
 * never from anything the form sent.
 */

type Client = SupabaseClient<Database>;

export type SignInResult =
  | { ok: true; userId: string; role: Role }
  | { ok: false; error: string };

export const REFUSED = "Those details were not accepted.";
export const NO_MATCH = "No account matches that name and mobile number. Check the spelling of your name, or ask the office.";
export const TWO_MATCH = "Two accounts have this name and mobile number. Ask the office to correct one of them.";
/** The 10 digits of what was typed in the mobile box, or "" when it is not a mobile. */
export function cleanMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return isValidMobile(digits) ? digits : "";
}

type Worker = { id: string; role: Role; email: string };

/** The one active worker with this name and mobile, or why there is not one. */
async function findWorker(name: string, mobile: string): Promise<Worker | { error: string }> {
  if (!normaliseName(name) || !isValidMobile(mobile)) return { error: NO_MATCH };
  const { data, error } = await supabaseAdmin().rpc("worker_for_sign_in", { p_name: name, p_mobile: mobile });
  if (error) return { error: "Sign-in is not available right now. Try again in a minute." };
  const rows = (data ?? []) as Worker[];
  if (rows.length === 0) return { error: NO_MATCH };
  if (rows.length > 1) return { error: TWO_MATCH };
  return rows[0]!;
}

/**
 * Opens a session for a worker the server has already identified, on `client` —
 * the cookie client on the website, a throwaway one for the app. The admin API
 * makes a one-time sign-in token (nothing is mailed) and the client spends it
 * at once, so no password is involved at any point.
 */
async function openSession(email: string, client: Client): Promise<string | undefined> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return undefined;
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) return undefined;
  return verified.user?.id;
}

/** Name and mobile, for everyone who works for NBSS. */
export async function signInWorker(name: string, mobile: string, client: Client): Promise<SignInResult> {
  const worker = await findWorker(name, mobile);
  if ("error" in worker) return { ok: false, error: worker.error };
  return finish(client, await openSession(worker.email, client));
}

/**
 * Where to go after signing in. A `from` inside the console is honoured — the
 * page there re-checks the role and sends anyone who does not belong back to
 * their own home — anything else lands on the role's dashboard.
 */
export async function landingFor(role: Role, userId: string, from: string): Promise<string> {
  if (from.startsWith("/console/") && !from.startsWith("//")) return from;
  // A client with nothing yet goes straight to the booking form. Decided here rather
  // than by a second redirect on /console/site, which a server action's redirect cannot
  // follow cleanly.
  if (role === "client") {
    const admin = supabaseAdmin();
    const [{ count: sites }, { count: requests }] = await Promise.all([
      admin.from("sites").select("id", { count: "exact", head: true }).eq("client_id", userId),
      admin.from("service_requests").select("id", { count: "exact", head: true }).eq("client_id", userId),
    ]);
    if (!sites && !requests) return "/console/book";
  }
  return homeFor(role);
}

/** The signed-in user's role, or a refusal that also signs them out again. */
export async function finish(client: Client, userId: string | undefined): Promise<SignInResult> {
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

/**
 * A client that keeps its session in memory only, for the app's endpoints: it
 * signs in, hands the tokens back to the phone, and is thrown away. The phone
 * then holds the session in its own encrypted store.
 */
export function statelessClient(): Client {
  return createClient<Database>(serverSupabaseUrl(), SUPABASE_PUBLISHABLE_KEY, {
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
