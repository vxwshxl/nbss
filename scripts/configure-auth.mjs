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
 * SMTP credentials and the sender come from .env.
 */

import { execFileSync } from "node:child_process";

import { readEnv } from "./db.mjs";

const HOST = process.env.NBSS_HOST ?? "root@187.126.117.188";
const TENANT_DIR = "/root/supafleet/tenants/nbss";

const env = readEnv();
for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "NEXT_PUBLIC_BASE_URL"]) {
  if (!env[key]) throw new Error(`${key} is not set in .env`);
}

const site = env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "");
const template = `${site}/email/auth-code.html`;

const settings = {
  GOTRUE_SITE_URL: site,
  GOTRUE_URI_ALLOW_LIST: `${site}/**,http://localhost:3000/**`,
  GOTRUE_SMTP_HOST: env.SMTP_HOST,
  GOTRUE_SMTP_PORT: String(env.SMTP_PORT),
  GOTRUE_SMTP_USER: env.SMTP_USER,
  GOTRUE_SMTP_PASS: env.SMTP_PASS,
  GOTRUE_SMTP_ADMIN_EMAIL: env.SMTP_FROM,
  GOTRUE_SMTP_SENDER_NAME: "NBSS",
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
  GOTRUE_SESSIONS_TIMEBOX: "0",
  GOTRUE_SESSIONS_INACTIVITY_TIMEOUT: "0",
};

for (const [key, value] of Object.entries(settings)) {
  if (value.includes("\n")) throw new Error(`${key} must be a single line`);
}

// The new values travel on stdin, never on a command line where `ps` would show them.
const remote = `set -euo pipefail
cd ${TENANT_DIR}
new=$(cat)
keys=$(printf '%s\\n' "$new" | cut -d= -f1 | paste -sd'|')
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
  smtp_sender: `NBSS <${env.SMTP_FROM}>`,
  template,
  otp_length: 6,
  otp_exp_s: 600,
  auth: status,
});
