"use client";

import { createBrowserClient } from "@supabase/ssr";

import { SESSION_MAX_AGE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { DATA_MODE_COOKIE, DATA_MODE_HEADER, parseMode } from "@/lib/mode/shared";

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
  // Test / Live (developers only; the switch reloads the page, so this is read once).
  const mode = parseMode(typeof document === "undefined" ? null : document.cookie.match(new RegExp(`(?:^|; )${DATA_MODE_COOKIE}=([^;]*)`))?.[1]);
  cached ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { maxAge: SESSION_MAX_AGE, sameSite: "lax", path: "/" },
    global: { headers: { [DATA_MODE_HEADER]: mode } },
  });
  return cached;
}
