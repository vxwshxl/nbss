/**
 * Points Supabase Auth (GoTrue) at the ZeptoMail SMTP relay and sets the
 * sign-in code rules, so the 6-digit codes are issued, mailed and verified by
 * Supabase itself — the same way from the website and the app.
 *
 *   node scripts/configure-auth.mjs
 *
 * Supabase is the self-hosted Supafleet tenant `nbss` on okhrang.core
 * (supabase.nbsskokrajhar.com). GoTrue there is configured by env, not by an
 * API: this rewrites the managed keys in the tenant's auth.env over SSH and
 * recreates the auth container. Every other key SupAdmin wrote is left alone.
 *
 * Self-hosted GoTrue reads email templates from a URL, so the code email is
 * `apps/web/public/email/auth-code.html`, served by the site itself. Deploy the
 * site before running this if the template changed.
 *
 * SMTP credentials, the sender and the Google OAuth client come from .env.
 *
 * Google sends people back to `<supabase>/auth/v1/callback` — that exact URL
 * must be an authorized redirect URI on the OAuth client in Google Cloud.
 */

import { execFileSync } from "node:child_process";

import { readEnv } from "./db.mjs";

const HOST = process.env.NBSS_HOST ?? "root@187.126.117.188";
const TENANT_DIR = "/root/supafleet/tenants/nbss";

const env = readEnv();
for (const key of [
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "NEXT_PUBLIC_SUPABASE_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
]) {
  if (!env[key]) throw new Error(`${key} is not set in .env`);
}

// Production, not .env's NEXT_PUBLIC_BASE_URL: locally that is localhost, and GoTrue
// fetches the template and builds redirects from this.
const site = (process.env.NBSS_SITE_URL ?? "https://nbsskokrajhar.com").replace(/\/+$/, "");
const template = `${site}/email/auth-code.html`;
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");

const settings = {
  GOTRUE_SITE_URL: site,
  // The app's own link for Google sign-in (nbss://auth/callback), and Expo Go's
  // (exp://<laptop>:8081/--/auth/callback) while developing.
  GOTRUE_URI_ALLOW_LIST: `${site}/**,http://localhost:3000/**,nbss://**,exp://**`,
  GOTRUE_SMTP_HOST: env.SMTP_HOST,
  GOTRUE_SMTP_PORT: String(env.SMTP_PORT),
  GOTRUE_SMTP_USER: env.SMTP_USER,
  GOTRUE_SMTP_PASS: env.SMTP_PASS,
  GOTRUE_SMTP_ADMIN_EMAIL: env.SMTP_FROM,
  GOTRUE_SMTP_SENDER_NAME: "NBSS Kokrajhar",
  GOTRUE_SMTP_MAX_FREQUENCY: "30s",
  GOTRUE_RATE_LIMIT_EMAIL_SENT: "200",
  GOTRUE_MAILER_OTP_LENGTH: "6",
  GOTRUE_MAILER_OTP_EXP: "600",
  GOTRUE_MAILER_SUBJECTS_MAGIC_LINK: "{{ .Token }} is your NBSS sign-in code",
  GOTRUE_MAILER_TEMPLATES_MAGIC_LINK: template,
  GOTRUE_MAILER_SUBJECTS_CONFIRMATION: "{{ .Token }} is your NBSS verification code",
  GOTRUE_MAILER_TEMPLATES_CONFIRMATION: template,
  GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE: "{{ .Token }} confirms your new NBSS email",
  GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE: template,
  GOTRUE_MAILER_SUBJECTS_RECOVERY: "{{ .Token }} is your NBSS reset code",
  GOTRUE_MAILER_TEMPLATES_RECOVERY: template,
  GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true",
  GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
  GOTRUE_EXTERNAL_GOOGLE_SECRET: env.GOOGLE_CLIENT_SECRET,
  GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: `${supabaseUrl}/auth/v1/callback`,
};

// Sessions never time out. Cloud took 0 for "off"; self-hosted GoTrue refuses to start
// on 0 and means "off" by the key being absent, so these are removed, never set.
const removed = ["GOTRUE_SESSIONS_TIMEBOX", "GOTRUE_SESSIONS_INACTIVITY_TIMEOUT"];

for (const [key, value] of Object.entries(settings)) {
  if (value.includes("\n")) throw new Error(`${key} must be a single line`);
}

// The new values travel on stdin, never on a command line where `ps` would show them.
const remote = `set -euo pipefail
cd ${TENANT_DIR}
new=$(cat)
keys="$(printf '%s\\n' "$new" | cut -d= -f1 | paste -sd'|')|${removed.join("|")}"
{ grep -vE "^($keys)=" auth.env || true; printf '%s\\n' "$new"; } > auth.env.next
chmod 600 auth.env.next && mv auth.env.next auth.env
docker compose up -d --force-recreate auth >/dev/null 2>&1
for i in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' auth-nbss)" = healthy ] && break
  sleep 2
done
docker inspect -f '{{.State.Health.Status}}' auth-nbss`;

const status = execFileSync("ssh", [HOST, remote], {
  input: Object.entries(settings).map(([k, v]) => `${k}=${v}`).join("\n"),
  encoding: "utf8",
}).trim();

console.log("Auth configured:", {
  site,
  smtp_sender: `NBSS Kokrajhar <${env.SMTP_FROM}>`,
  template,
  otp_length: 6,
  otp_exp_s: 600,
  google_redirect: settings.GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI,
  auth: status,
});
