/** The App updates form's state. Separate because a "use server" module may only export async functions. */
export type ReleaseState = {
  ok: boolean;
  error?: string;
  message?: string;
  /** What was typed, so a refused form comes back as it was rather than blank. */
  values?: { version_code: string; version_name: string; store_url: string; notes: string };
};
export const emptyReleaseState: ReleaseState = { ok: false };
