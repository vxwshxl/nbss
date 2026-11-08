import type { Break } from "@nbss/shared/shifts";

import { WEB_URL } from "./config";
import { supabase } from "./supabase";

/**
 * Posting from the app: the website's own rules (apps/web/src/app/api/roster/posting),
 * so the app and the console never disagree about who may be posted where. Signed in
 * with this person's session; an administrator or a supervisor only.
 */
export type PostingInput = {
  guardId: string;
  siteId: string;
  starts: string;
  ends: string;
  days: number[];
  breaks: Break[];
};

type Result = { ok: true; note?: string } | { ok: false; error: string };

async function call(method: "POST" | "DELETE", body: unknown): Promise<Result> {
  if (!WEB_URL) return { ok: false, error: "The website address is not set, so the post cannot be saved." };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Please sign in again." };
  try {
    const res = await fetch(`${WEB_URL}/api/roster/posting`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as Result | null;
    return json ?? { ok: false, error: "The website did not answer. Try again." };
  } catch {
    return { ok: false, error: "No connection. Try again when you have signal." };
  }
}

export const savePosting = (input: PostingInput) => call("POST", input);
export const endPosting = (postingId: string) => call("DELETE", { postingId });
