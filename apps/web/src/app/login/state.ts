/**
 * The staff sign-in form's state. Separate from actions.ts because a "use
 * server" module may only export async functions.
 */
export type SignInState = {
  /** Echoed back so a refused attempt keeps what was typed. */
  name: string;
  mobile: string;
  error?: string;
};

export const initialSignInState: SignInState = { name: "", mobile: "" };

/** A `from` we are willing to send someone back to: inside the console only. */
export function safeFrom(from: string | undefined | null): string {
  return from && from.startsWith("/console/") && !from.startsWith("//") ? from : "";
}

/** Why a Google sign-in bounced back to /login, as the page shows it. */
export const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in did not finish. Try again.",
  refused: "That Google account is not registered with NBSS. Staff and guards sign in with their name and mobile number.",
};
