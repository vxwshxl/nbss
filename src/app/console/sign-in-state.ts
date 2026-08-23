/**
 * The sign-in form's state shape.
 *
 * It lives here rather than in actions.ts because a "use server" module may
 * only export async functions — a plain object export makes the whole file
 * fail to compile, since Next has to treat every export as a callable server
 * reference.
 */
export type SignInState = {
  ok: boolean;
  /** Echoed back so a failed attempt keeps the code but never the secret. */
  code: string;
  error?: string;
};

export const emptySignInState: SignInState = { ok: false, code: "" };
