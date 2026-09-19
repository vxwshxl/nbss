"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * The client-side client, used for the things that genuinely have to happen in
 * the browser: reading the live location feed, and subscribing to realtime
 * channels for the admin map.
 *
 * It only ever holds the publishable key, so every query it makes is still
 * filtered by row level security. Writes that carry a decision — a punch, a
 * task completion, a roster change — go through server actions instead, so the
 * rule that allows them lives on the server where it cannot be edited.
 */

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  cached ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return cached;
}
