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

export type Role = "developer" | "admin" | "supervisor" | "guard" | "client";

/** Highest authority first. Mirrors the `user_role` enum's order in Postgres. */
export const ROLES: readonly Role[] = ["developer", "admin", "supervisor", "guard", "client"];

export const ROLE_LABEL: Record<Role, string> = {
  developer: "Developer",
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

/**
 * What a guard-role account does on site (0050_housekeeping.sql). A housekeeper works
 * a site exactly as a guard does, so in the database they are the guard role with a
 * trade; everywhere a person reads, the trade is shown as its own role.
 */
export type Trade = "security" | "housekeeping";

/** The roles a person picks from: the five, with Housekeeper beside Guard. */
export type RoleChoice = Role | "housekeeping";

export const ROLE_CHOICES: readonly RoleChoice[] = ["developer", "admin", "supervisor", "guard", "housekeeping", "client"];

export const ROLE_CHOICE_LABEL: Record<RoleChoice, string> = { ...ROLE_LABEL, housekeeping: "Housekeeper" };

/** The choice a profile is shown as. */
export function roleChoice(role: Role, trade?: string | null): RoleChoice {
  return role === "guard" && trade === "housekeeping" ? "housekeeping" : role;
}

/** What a choice is stored as. */
export function fromRoleChoice(choice: RoleChoice): { role: Role; trade: Trade } {
  return choice === "housekeeping" ? { role: "guard", trade: "housekeeping" } : { role: choice, trade: "security" };
}

/** "Guard", "Housekeeper", "Supervisor" … for a profile. */
export function roleLabel(role: Role, trade?: string | null): string {
  return ROLE_CHOICE_LABEL[roleChoice(role, trade)];
}

/** Staff and guards. Everyone who works for NBSS rather than buys from it. */
export function isWorker(role: Role): boolean {
  return role !== "client";
}

export function isStaff(role: Role): boolean {
  return role === "developer" || role === "admin" || role === "supervisor";
}

/** Administrators and developers. A developer can do everything an admin can. */
export function isAdmin(role: Role): boolean {
  return role === "developer" || role === "admin";
}

/**
 * Whether `role` passes a check written as a list of roles. A developer passes
 * any list an administrator would, so call sites keep naming "admin" and the
 * developer comes along without every list repeating it.
 */
export function roleAllowed(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role) || (role === "developer" && allowed.includes("admin"));
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
/** Upper-cased, no spaces; a bare number ("11") is read as NBSS-11. */
export function normaliseCode(code: string): string {
  return expandEmployeeCode(code);
}

/** Mirrors the CHECK constraint on profiles.employee_code. */
export function isValidCode(code: string): boolean {
  return /^[A-Z0-9-]{3,20}$/.test(normaliseCode(code));
}

/**
 * One shape of secret: a 4-digit PIN, for every role. It is typed on a phone at a
 * gate as often as at a desk; the sign-in's throttle carries the security, not the
 * length. Stored as `pinPassword(pin)` below.
 */
export function isValidSecret(secret: string): boolean {
  return /^\d{4}$/.test(secret);
}

/** The same 4-digit rule. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
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

/**
 * Country codes the phone fields offer. India first and preset; then the neighbours
 * and the countries families most often work in.
 */
export const COUNTRY_CODES = [
  { code: "+91", label: "India" },
  { code: "+977", label: "Nepal" },
  { code: "+975", label: "Bhutan" },
  { code: "+880", label: "Bangladesh" },
  { code: "+95", label: "Myanmar" },
  { code: "+971", label: "UAE" },
  { code: "+966", label: "Saudi Arabia" },
  { code: "+65", label: "Singapore" },
  { code: "+44", label: "UK" },
  { code: "+1", label: "USA / Canada" },
] as const;

/**
 * How a number is stored: an Indian number as its 10 digits (as every number on file
 * already is), any other as "+<code><10 digits>".
 */
export function joinPhone(countryCode: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  return countryCode === "+91" ? digits : `${countryCode}${digits}`;
}

/** The other way: the country code and the 10 digits, for a phone field's starting value. */
export function splitPhone(stored: string | null | undefined): { code: string; national: string } {
  const t = (stored ?? "").replace(/[\s-]/g, "");
  if (t.startsWith("+") && !t.startsWith("+91")) {
    const c = COUNTRY_CODES.map((x) => x.code).sort((a, b) => b.length - a.length).find((x) => t.startsWith(x));
    if (c) return { code: c, national: t.slice(c.length).replace(/\D/g, "") };
  }
  return { code: "+91", national: normalisePhone(t) };
}

/** Exactly 10 digits after the country code; an Indian mobile starts 6–9. */
export function isValidPhone(phone: string): boolean {
  const { code, national } = splitPhone(phone);
  if (!/^\d{10}$/.test(national)) return false;
  return code === "+91" ? /^[6-9]/.test(national) : true;
}

/**
 * The one or two letters an avatar falls back to when there is no photo.
 * "Diyan Brahma" → "DB", "Ripun" → "RI", "" → "?".
 *
 * Lived as a private copy in four components on the web before it was centralised; the
 * Expo app would have made a fifth, so it moved here instead. Keep new avatars on this one
 * so a name renders the same in the browser and on a phone.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first || !last) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * A 4-digit PIN as the password Supabase stores. Auth needs at least six characters,
 * and a guard types four digits, so the PIN is wrapped the same way on every side
 * (console account creation, website and app sign-in). Older 6–12 digit PINs and
 * passphrases are used as typed.
 */
export const EMPLOYEE_PREFIX = "NBSS-";

export function isShortPin(secret: string): boolean {
  return /^\d{4}$/.test(secret);
}

export function pinPassword(secret: string): string {
  return isShortPin(secret) ? `nbss-pin-${secret}` : secret;
}

/**
 * "42", "042", "NBSS-42" and "nbss-042" all mean NBSS-42: codes run 1, 2, 3… with no
 * leading zeros, and a zero typed from an old printed card is dropped. Any other code
 * is kept as written.
 */
export function expandEmployeeCode(raw: string): string {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  const n = /^(?:NBSS-)?(\d{1,6})$/.exec(code)?.[1];
  return n ? `${EMPLOYEE_PREFIX}${Number(n)}` : code;
}
