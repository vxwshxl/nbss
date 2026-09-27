/**
 * Points Supabase Auth (GoTrue) at the ZeptoMail SMTP relay and sets the
 * sign-in code rules, so the 6-digit codes are issued, mailed and verified by
 * Supabase itself — the same way from the website and the app.
 *
 *   node scripts/configure-auth.mjs
 *
 * Needs the Supabase CLI to be logged in (`supabase login`): the Management API
 * token is read from the CLI's keychain entry, never from a file in the repo.
 * SMTP credentials come from .env.
 */

import { execSync } from "node:child_process";

import { readEnv } from "./db.mjs";

const env = readEnv();
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];

function cliToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  let raw = execSync('security find-generic-password -s "Supabase CLI" -w', {
    encoding: "utf8",
  }).trim();
  if (raw.startsWith("go-keyring-base64:")) {
    raw = Buffer.from(raw.slice("go-keyring-base64:".length), "base64").toString("utf8");
  }
  return raw;
}

for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) {
  if (!env[key]) throw new Error(`${key} is not set in .env`);
}

const code = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ebebeb">
            <tr>
              <td style="background:#009164;background-image:linear-gradient(100deg,#009164 10%,#006b4a 90%);padding:22px 28px;color:#ffffff">
                <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em">NBSS</div>
                <div style="font-size:12px;opacity:.85;margin-top:2px">National Bodo Security Service</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <p style="margin:0 0 6px;font-size:15px;font-weight:600">Your sign-in code</p>
                <p style="margin:0 0 20px;font-size:14px;color:#5d5d5d">Enter this code to finish signing in. It expires in 10 minutes.</p>
                <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#047857;background:#e9f8f1;border-radius:12px;padding:16px 0;text-align:center">{{ .Token }}</div>
                <p style="margin:22px 0 0;font-size:12px;color:#8a8a8a">If you did not try to sign in, you can ignore this email — nobody can sign in without the code.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8a8a">NBSS · Kokrajhar, Assam</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const body = {
  smtp_host: env.SMTP_HOST,
  smtp_port: String(env.SMTP_PORT),
  smtp_user: env.SMTP_USER,
  smtp_pass: env.SMTP_PASS,
  smtp_admin_email: env.SMTP_FROM,
  smtp_sender_name: "NBSS",
  // Seconds between two mails to the same address — the resend cooldown.
  smtp_max_frequency: 30,
  // Per hour, across the project. The default of 2 is for the shared test
  // mailer; with our own relay it only needs to stop a runaway loop.
  rate_limit_email_sent: 200,
  mailer_otp_length: 6,
  mailer_otp_exp: 600,
  // A code rather than a link, for every sign-in mail: a guard at a gate reads
  // six digits off a phone far more reliably than they follow a link that
  // opens the wrong browser.
  mailer_subjects_magic_link: "{{ .Token }} is your NBSS sign-in code",
  mailer_templates_magic_link_content: code,
  mailer_subjects_confirmation: "{{ .Token }} is your NBSS verification code",
  mailer_templates_confirmation_content: code,
  mailer_subjects_email_change: "{{ .Token }} confirms your new NBSS email",
  mailer_templates_email_change_content: code,
  mailer_subjects_recovery: "{{ .Token }} is your NBSS reset code",
  mailer_templates_recovery_content: code,
  // Sessions last until someone signs out or clears their data. Stated
  // explicitly so a dashboard change does not quietly start logging guards
  // out mid-shift.
  sessions_timebox: 0,
  sessions_inactivity_timeout: 0,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${cliToken()}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const after = await res.json();
console.log("Auth configured:", {
  smtp_host: after.smtp_host,
  smtp_sender: `${after.smtp_sender_name} <${after.smtp_admin_email}>`,
  otp_length: after.mailer_otp_length,
  otp_exp_s: after.mailer_otp_exp,
  email_rate_per_hour: after.rate_limit_email_sent,
});
