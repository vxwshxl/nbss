import "server-only";

import { cookies } from "next/headers";

import type { Profile } from "@/lib/auth";

/**
 * "View as" — an admin opening the console through someone else's eyes.
 *
 * The target's id is kept in an httpOnly cookie and re-checked on every
 * request: the session still belongs to the administrator, and the cookie only
 * changes which profile the pages read. That ordering matters — a guard who
 * forged this cookie would gain nothing, because the check below refuses
 * unless the *real* signed-in account is an admin.
 *
 * Writes are allowed while impersonating, so an admin can fix something on a
 * guard's behalf, with one exception. Attendance is refused: a punch is meant
 * to be evidence that a specific person stood at a specific gate, and letting
 * an administrator create one from a desk would make the whole ledger
 * unciteable for payroll or a client dispute. `assertCanWrite` is what
 * enforces that.
 */

export const IMPERSONATION_COOKIE = "nbss_view_as";

export const impersonationCookie = {
  name: IMPERSONATION_COOKIE,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/console",
  // Deliberately short. Forgetting you are viewing as someone else is the
  // failure mode here, so it lapses on its own within a working session.
  maxAge: 60 * 60 * 4,
} as const;

export async function impersonatedId(): Promise<string | null> {
  return (await cookies()).get(IMPERSONATION_COOKIE)?.value ?? null;
}

export type Session = {
  /** Whose console this is — the impersonated profile when one is active. */
  profile: Profile;
  /** Who is really signed in. Identical to `profile` when not impersonating. */
  realProfile: Profile;
  impersonating: boolean;
};

/**
 * Refuses a write that must not be attributable to the wrong person.
 *
 * Called at the top of any action that records evidence rather than
 * administration. Throwing rather than returning an error: this is a
 * programming-level guarantee, and a caller that forgets to check a return
 * value would silently reopen the hole.
 */
export function assertCanWrite(session: Session, kind: "attendance" | "general" = "general"): void {
  if (session.impersonating && kind === "attendance") {
    throw new Error(
      "Attendance cannot be recorded while viewing as another person. Stop viewing as them first — a punch has to belong to whoever was actually at the gate.",
    );
  }
}
