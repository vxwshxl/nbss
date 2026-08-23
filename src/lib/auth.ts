import "server-only";

import { redirect } from "next/navigation";

import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import type { Enums, Row } from "@/lib/supabase/types";

export type Role = Enums["user_role"];
export type Profile = Row<"profiles">;

/**
 * Identity for people who do not have email.
 *
 * A guard signs in with the employee code printed on their card and a PIN.
 * Supabase Auth is built around an email address, so one is synthesized from
 * the code and kept entirely internal — it is never displayed, never sent to,
 * and never typed by anyone. The subdomain is deliberately one that does not
 * accept mail, so a misconfiguration cannot quietly deliver a password reset
 * somewhere unintended.
 *
 * Staff with a real address keep it; the code is still their username.
 */
const STAFF_DOMAIN = "staff.nbss.co.in";

export function codeToEmail(code: string): string {
  return `${normaliseCode(code).toLowerCase()}@${STAFF_DOMAIN}`;
}

/** Codes are stored and compared uppercase, so case at the keypad never matters. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Mirrors the CHECK constraint on profiles.employee_code. */
export function isValidCode(code: string): boolean {
  return /^[A-Z0-9-]{3,20}$/.test(normaliseCode(code));
}

/**
 * A PIN is short by design — it is typed on a phone at a gate, in the dark,
 * often in a hurry. Six digits with lockout after repeated failures is the
 * trade the situation calls for; the throttle in the sign-in action is what
 * actually carries the security here, not the length.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{6,12}$/.test(pin);
}

/**
 * The signed-in person's profile, or null.
 *
 * `getUser()` rather than `getSession()`: the session is read from a cookie the
 * browser controls, while `getUser()` revalidates it against Supabase. For a
 * system where the difference is "may this person mark themselves present",
 * that round trip is worth it.
 */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  // A profile row that is missing or deactivated means no access, even though
  // the auth user still exists — deactivating a guard should not require
  // deleting their attendance history.
  if (!data || !data.active) return null;

  return data;
}

/** Redirects to sign-in when nobody is signed in. */
export async function requireProfile(): Promise<Profile> {
  const profile = await currentProfile();
  if (!profile) redirect("/console/login");
  return profile;
}

/**
 * Redirects when the signed-in person's role is not on the list.
 *
 * Sending someone to their own dashboard rather than to an error page: a guard
 * who follows a stale link to an admin screen has not done anything wrong, and
 * a permission error would just be noise.
 */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
    case "supervisor":
      return "/console";
    case "guard":
      return "/console/duty";
    case "client":
      return "/console/site";
  }
}

/**
 * Creates a login and its profile together.
 *
 * Both halves must exist or neither should: an auth user without a profile can
 * sign in and then hit a wall, and a profile without an auth user is a row
 * nobody can ever use. If the profile insert fails the auth user is deleted
 * again, which is the closest thing to a transaction available across the two.
 */
export async function createStaffAccount(input: {
  employeeCode: string;
  pin: string;
  fullName: string;
  role: Role;
  phone?: string;
  email?: string;
}): Promise<{ id: string } | { error: string }> {
  const code = normaliseCode(input.employeeCode);

  if (!isValidCode(code)) return { error: "Employee code must be 3–20 letters, digits or hyphens." };
  if (!isValidPin(input.pin)) return { error: "PIN must be 6–12 digits." };

  const admin = supabaseAdmin();

  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();
  if (taken) return { error: `Employee code ${code} is already in use.` };

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email?.trim() || codeToEmail(code),
    password: input.pin,
    // Marked confirmed on creation, so Supabase never tries to deliver a
    // verification mail to an address that does not receive any.
    email_confirm: true,
    user_metadata: { employee_code: code, full_name: input.fullName },
  });

  if (authError || !created.user) {
    return { error: authError?.message ?? "Could not create the login." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    employee_code: code,
    role: input.role,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  return { id: created.user.id };
}

/**
 * Resolves an employee code to the address its login is registered under.
 *
 * Runs on the admin client because it necessarily happens before anyone is
 * signed in, and so has nothing to be filtered by. It returns null for both an
 * unknown code and a deactivated one — the sign-in action reports a single
 * message for either, so a stranger cannot use the form to learn which
 * employee codes exist.
 */
export async function emailForCode(code: string): Promise<string | null> {
  const normalised = normaliseCode(code);
  if (!isValidCode(normalised)) return null;

  const admin = supabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, active")
    .eq("employee_code", normalised)
    .maybeSingle();

  if (!profile || !profile.active) return null;

  const { data } = await admin.auth.admin.getUserById(profile.id);
  return data.user?.email ?? null;
}

/** Appends to the audit log. Never throws: a failed log must not fail the action. */
export async function audit(entry: {
  actor: Profile | null;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin()
      .from("audit_log")
      .insert({
        actor_id: entry.actor?.id ?? null,
        actor_code: entry.actor?.employee_code ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entity_id: entry.entityId ?? null,
        detail: (entry.detail ?? null) as never,
        ip: entry.ip ?? null,
      });
  } catch {
    // Swallowed deliberately — losing an audit line is bad, but refusing a
    // guard's check-in because the log was unreachable is worse.
  }
}
