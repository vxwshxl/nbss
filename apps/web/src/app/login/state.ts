/**
 * The sign-in form's state. Separate from actions.ts because a "use server"
 * module may only export async functions.
 */
export type SignInState = {
  step: "identify" | "code" | "password";
  /** Echoed back so every step keeps what was typed — never the secret. */
  identifier: string;
  error?: string;
  notice?: string;
  /** When the last code was requested, to restart the resend countdown. */
  sentAt?: number;
};

export const initialSignInState: SignInState = { step: "identify", identifier: "" };

/** A `from` we are willing to send someone back to: inside the console only. */
export function safeFrom(from: string | undefined | null): string {
  return from && from.startsWith("/console/") && !from.startsWith("//") ? from : "";
}
