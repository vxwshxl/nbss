import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "@nbss/shared/db";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import { DATA_MODE_HEADER, dataMode } from "./data-mode";
import { secureStorage } from "./secure-storage";

/**
 * The app's only Supabase client.
 *
 * It holds the publishable key, so every read it makes is filtered by the row
 * level security in 0004–0007, and every write that carries a decision — a punch,
 * a position, an SOS — goes through an RPC that takes the actor from the JWT
 * rather than from an argument. There is deliberately no admin client here: an app
 * on a guard's phone is the least trustworthy place in the system, and nothing it
 * can hold should be able to bypass a policy.
 *
 * `detectSessionInUrl` is off because there is no URL to detect one in; leaving it
 * on makes the client reach for `window.location` and throw on native.
 *
 * Each request is stamped with the Test / Live mode as it stands when it is sent
 * (lib/data-mode.tsx), so a developer's switch takes effect without a new client.
 */
/**
 * No request waits for ever. On a weak signal a request can hang with the connection
 * up but nothing moving; without a limit a screen spun until the app was closed. After
 * this long it fails like any other network error, so the retries, the location outbox
 * and the reload when the app returns to the front take over. A caller's own abort
 * still applies.
 */
const REQUEST_TIMEOUT_MS = 25_000;

function withTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE: Google sign-in returns a one-time code to the app's own link
    // (nbss://auth/callback), which only this install can exchange for a session.
    flowType: "pkce",
  },
  realtime: {
    // Positions arrive as one batch every fifteen seconds and SOS events are rare,
    // so the default of ten messages a second is far more headroom than this needs.
    // Lowering it means a misbehaving channel cannot flood the render loop.
    params: { eventsPerSecond: 4 },
  },
  global: {
    headers: { "x-nbss-client": "mobile" },
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set(DATA_MODE_HEADER, dataMode());
      return withTimeout(input, { ...init, headers });
    },
  },
});

/**
 * The session's token is refreshed only while the app is in front, and checked the
 * moment it returns. A phone that slept overnight wakes with an expired token; without
 * this the first requests after reopening fail before the timer catches up. Supabase's
 * own guidance for React Native. The realtime socket reconnects by itself.
 *
 * The background location task is unaffected: every request reads the session first,
 * and an expired token is refreshed right then, timer or no timer.
 */
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
