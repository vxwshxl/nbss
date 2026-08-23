/**
 * Result of a check-in or check-out attempt. Kept out of actions.ts because a
 * "use server" module may only export async functions.
 */
export type PunchState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** Metres from the site centre, when the attempt got far enough to know. */
  distance?: number;
};

export const emptyPunchState: PunchState = { ok: false };
