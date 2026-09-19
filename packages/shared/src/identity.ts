/**
 * Who someone is, decided identically on every client.
 *
 * A guard signs in with the employee code printed on their card and a PIN.
 * Supabase Auth is built around an email address, so one is synthesized from
 * the code and kept entirely internal — never displayed, never sent to, never
 * typed by anyone. The subdomain deliberately accepts no mail, so a
 * misconfiguration cannot quietly deliver a password reset somewhere.
 *
 * These rules were previously only in the web app's `lib/auth.ts`. The phone
 * has to normalise a code the same way before it asks the server about it, and
 * a second copy would drift — so the pure half lives here and the server-only
 * half (session reading, account creation) stays where it can reach Postgres.
 */

export type Role = "admin" | "supervisor" | "guard" | "client";

export const ROLES: readonly Role[] = ["admin", "supervisor", "guard", "client"];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

/** Staff and guards. Everyone who works for NBSS rather than buys from it. */
export function isWorker(role: Role): boolean {
  return role !== "client";
}

export function isStaff(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

const STAFF_DOMAIN = "staff.nbss.co.in";

/** Clients register with a real address; only workers get a synthetic one. */
const CLIENT_DOMAIN_NOTE =
  "Clients sign in with their own email, so this is never called for them.";

export function codeToEmail(code: string): string {
  return `${normaliseCode(code).toLowerCase()}@${STAFF_DOMAIN}`;
}

export { CLIENT_DOMAIN_NOTE };

/** Codes are stored and compared uppercase, so case at the keypad never matters. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** Mirrors the CHECK constraint on profiles.employee_code. */
export function isValidCode(code: string): boolean {
  return /^[A-Z0-9-]{3,20}$/.test(normaliseCode(code));
}

/**
 * Two shapes of secret, because two very different people type them.
 *
 * A guard's PIN is short by design — entered on a phone at a gate, in the dark,
 * often in the rain. Six digits plus lockout is the trade that situation calls
 * for; the throttle on the sign-in action carries the security, not the length.
 *
 * Office staff sit at a desk and hold far more authority — an admin can move a
 * geofence or rewrite attendance — so they get a real passphrase, and a
 * digit-only rule would only weaken them. A client is in the same position as
 * office staff: a keyboard, and an account worth protecting properly.
 */
export function isValidSecret(secret: string, role: Role): boolean {
  return role === "guard" ? /^\d{6,12}$/.test(secret) : secret.length >= 8;
}

/** Guards only. Kept for the check-in screens, which never see another role. */
export function isValidPin(pin: string): boolean {
  return /^\d{6,12}$/.test(pin);
}

/**
 * Good enough to be worth sending to the server.
 *
 * Not a claim that the address exists — only the server can know that, and it
 * finds out by mailing it. This is the check that stops an obvious typo
 * becoming a round trip.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(trimmed);
}

/** Indian mobile numbers, with or without the +91 the keypad may or may not add. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalisePhone(phone));
}
