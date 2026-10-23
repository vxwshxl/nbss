/**
 * Push and email delivery: drains `push_outbox` to Expo's push service and
 * `email_outbox` to ZeptoMail (0022_field_ops.sql; templates in
 * ./email-templates.mjs).
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

import { render } from "./email-templates.mjs";

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

/**
 * Mail goes through ZeptoMail's HTTP API, the same agent and token as the
 * sign-in codes (see src/lib/mail.ts for why the SMTP password is the token).
 * Reserved test domains are refused here, so an E2E run never sends anything.
 */
const MAIL_HOST = process.env.SMTP_HOST;
const MAIL_TOKEN = process.env.SMTP_PASS;
const MAIL_FROM = process.env.SMTP_FROM;
const RESERVED = /@([^@]+\.)?(test|invalid|example|localhost)$|@example\.(com|org|net)$/i;

async function sendMail(row) {
  if (RESERVED.test(row.to_email)) return { ok: false, final: true, error: "reserved test domain, not sent" };
  if (!MAIL_HOST || !MAIL_TOKEN || !MAIL_FROM) return { ok: false, error: "SMTP_HOST, SMTP_PASS and SMTP_FROM must be set" };
  const body = render(row);
  if (!body) return { ok: false, final: true, error: `unknown template ${row.template}` };
  try {
    const res = await fetch(`https://${MAIL_HOST.replace(/^smtp\./, "api.")}/v1.1/email`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${MAIL_TOKEN.replace(/^Zoho-enczapikey\s+/, "")}`,
      },
      body: JSON.stringify({
        from: { address: MAIL_FROM, name: "NBSS Kokrajhar" },
        to: [{ email_address: { address: row.to_email, ...(row.to_name && { name: row.to_name }) } }],
        subject: row.subject,
        htmlbody: body.html,
        textbody: body.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    return { ok: false, final: res.status >= 400 && res.status < 500 && res.status !== 429, error: `ZeptoMail ${res.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

async function mailRound() {
  const { data: batch, error } = await db.rpc("claim_email_batch", { p_limit: 20 });
  if (error) throw new Error(`claim_email_batch: ${error.message}`);
  if (!batch?.length) return 0;
  for (const row of batch) {
    const r = await sendMail(row);
    // A refusal that will never succeed is recorded as the third attempt, so it stops.
    if (!r.ok && r.final) await db.from("email_outbox").update({ attempts: 3 }).eq("id", row.id);
    const { error: e } = await db.rpc("record_email_result", { p_id: row.id, p_ok: r.ok, p_error: r.error ?? null });
    if (e) throw new Error(`record_email_result: ${e.message}`);
    log(r.ok ? "mailed" : "mail failed", { id: row.id, template: row.template, ...(r.error && { error: r.error }) });
  }
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
  try {
    await mailRound();
  } catch (err) {
    log("mail error", { message: String(err?.message ?? err) });
  }
  // A full batch means more may be waiting; go again at once.
  if (handled < BATCH) await new Promise((r) => setTimeout(r, IDLE_MS));
}
log("stopped");
