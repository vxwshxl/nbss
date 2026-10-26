/**
 * Makes sure an email address has a working developer account.
 *
 * The developer role is the one role the console cannot hand out from scratch:
 * only a developer may grant it. So the first one comes from here. Safe to run
 * again: an existing account is promoted and reactivated, never duplicated.
 *
 *   pnpm db:developer                       # veebodosa@gmail.com
 *   pnpm db:developer someone@example.com "Their Name"
 *
 * Sign-in is by emailed code, so no password is set.
 */

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "./db.mjs";

const email = (process.argv[2] ?? "veebodosa@gmail.com").trim().toLowerCase();
const name = (process.argv[3] ?? "Vee").trim();

const env = readEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await admin
  .from("profiles")
  .select("id, role, active, employee_code")
  .eq("email", email)
  .maybeSingle();

if (existing) {
  const { error } = await admin
    .from("profiles")
    .update({ role: "developer", active: true })
    .eq("id", existing.id);
  if (error) {
    console.error(`Could not promote ${email}: ${error.message}`);
    process.exit(1);
  }
  console.log(`${email} (${existing.employee_code}) is a developer.`);
  process.exit(0);
}

// Every account is NBSS-n, developers included (0051).
const { data: code, error: codeError } = await admin.rpc("next_employee_code");
if (codeError || !code) {
  console.error(`Could not pick an employee code: ${codeError?.message ?? "unknown error"}`);
  process.exit(1);
}

const { data: created, error: authError } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: { employee_code: code, full_name: name },
});
if (authError || !created.user) {
  console.error(`Could not create login: ${authError?.message ?? "unknown error"}`);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: created.user.id,
  employee_code: code,
  role: "developer",
  full_name: name,
  email,
});
if (profileError) {
  await admin.auth.admin.deleteUser(created.user.id);
  console.error(`Could not create profile: ${profileError.message}`);
  process.exit(1);
}

console.log(`Created developer ${code} for ${email}. Sign in at /login with the emailed code.`);
