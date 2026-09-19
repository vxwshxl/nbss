import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@nbss/shared/db";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
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
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Positions arrive as one batch every fifteen seconds and SOS events are rare,
    // so the default of ten messages a second is far more headroom than this needs.
    // Lowering it means a misbehaving channel cannot flood the render loop.
    params: { eventsPerSecond: 4 },
  },
  global: {
    headers: { "x-nbss-client": "mobile" },
  },
});
