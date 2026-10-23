/**
 * Push delivery: drains `push_outbox` to Expo's push service.
 *
 * Runs beside the site under PM2 (`nbss-push`, see ecosystem.config.cjs). It
 * replaced the pg_net sender from 0006, which cannot send from this database on
 * the shared self-hosted cluster (0020_push_worker.sql explains why).
 *
 * The database still owns the queue: `claim_push_batch` marks a batch in flight
 * (SKIP LOCKED, so two workers never send one push twice) and
 * `record_push_tickets` writes back Expo's answer per message, disabling tokens
 * Expo reports dead. A claim this process never answers is re-queued by the
 * database after two minutes, so a crash mid-send costs a retry, not a push.
 *
 * Polls every two seconds: an SOS is queued by `raise_sos` and should be on
 * phones within a few seconds, and an empty poll is one indexed query.
 *
 *   node --env-file=.env scripts/push-worker.mjs
 */

import { createClient } from "@supabase/supabase-js";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100; // Expo's per-request maximum
const IDLE_MS = 2000;
const TIMEOUT_MS = 10_000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const log = (msg, extra) => console.log(`[push] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);

/** Expo's answer for each message, in the order they were sent. */
async function send(messages) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  // Required once the Expo project turns on enhanced push security; harmless before.
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  let res;
  try {
    res = await fetch(EXPO_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return messages.map(() => ({ status: "retry", error: String(err?.message ?? err) }));
  }

  const text = await res.text();
  if (res.status >= 500 || res.status === 429) {
    return messages.map(() => ({ status: "retry", error: `upstream ${res.status}` }));
  }
  if (res.status >= 400) {
    return messages.map(() => ({ status: "error", error: text.slice(0, 500) || `HTTP ${res.status}` }));
  }

  let tickets = [];
  try {
    tickets = JSON.parse(text).data ?? [];
  } catch {
    return messages.map(() => ({ status: "retry", error: "unreadable reply from Expo" }));
  }
  return messages.map((_, i) => {
    const t = tickets[i];
    if (!t) return { status: "retry", error: "no ticket for this message" };
    if (t.status === "ok") return { status: "ok" };
    return { status: "error", error: t.details?.error ?? t.message ?? "error" };
  });
}

/** One claim-send-record round. Returns how many messages it handled. */
async function round() {
  const { data: batch, error } = await db.rpc("claim_push_batch", { p_limit: BATCH });
  if (error) throw new Error(`claim_push_batch: ${error.message}`);
  if (!batch?.length) return 0;

  const answers = await send(batch.map((row) => row.message));
  const results = batch.map((row, i) => ({ id: row.id, ...answers[i] }));

  const { data: summary, error: recordError } = await db.rpc("record_push_tickets", { p_results: results });
  if (recordError) throw new Error(`record_push_tickets: ${recordError.message}`);
  log("sent", summary);
  return batch.length;
}

let running = true;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (running = false));

log("started", { url });
while (running) {
  let handled = 0;
  try {
    handled = await round();
  } catch (err) {
    log("error", { message: String(err?.message ?? err) });
  }
  // A full batch means more may be waiting; go again at once.
  if (handled < BATCH) await new Promise((r) => setTimeout(r, IDLE_MS));
}
log("stopped");
