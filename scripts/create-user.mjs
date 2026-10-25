/**
 * Creates a login and its profile.
 *
 * The first admin has to come from somewhere — there is no public signup, by
 * design. After that, accounts are normally created from the console; this
 * stays for bootstrapping and for recovering a locked-out admin.
 *
 *   node scripts/create-user.mjs --code NBSS-1 --name "Name" --role admin --pin 4819
 *
 * Omit --pin and one is generated and printed.
 */

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "./db.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
}

const code = (args.code ?? "").trim().toUpperCase();
const name = (args.name ?? "").trim();
const role = args.role ?? "guard";
const phone = args.phone ?? null;
// Four digits, never starting with a zero, as the console issues them.
const pin = args.pin ?? String(Math.floor(1000 + Math.random() * 9000));

if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
  console.error("--code must be 3–20 letters, digits or hyphens, e.g. NBSS-1");
  process.exit(1);
}
if (!name) {
  console.error("--name is required");
  process.exit(1);
}
if (!["developer", "admin", "supervisor", "guard", "client"].includes(role)) {
  console.error("--role must be developer, admin, supervisor, guard or client");
  process.exit(1);
}
// Every role signs in with a 4-digit PIN.
if (!/^\d{4}$/.test(pin)) {
  console.error("--pin must be 4 digits");
  process.exit(1);
}

const env = readEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Kept in step with codeToEmail() in src/lib/auth.ts.
const email = `${code.toLowerCase()}@staff.nbss.co.in`;

const { data: taken } = await admin
  .from("profiles")
  .select("id")
  .eq("employee_code", code)
  .maybeSingle();

if (taken) {
  console.error(`Employee code ${code} already exists.`);
  process.exit(1);
}

const { data: created, error: authError } = await admin.auth.admin.createUser({
  email,
  // As the sign-in stores a PIN (pinPassword in packages/shared/src/identity.ts).
  password: `nbss-pin-${pin}`,
  email_confirm: true,
  user_metadata: { employee_code: code, full_name: name },
});

if (authError) {
  console.error(`Could not create login: ${authError.message}`);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: created.user.id,
  employee_code: code,
  role,
  full_name: name,
  phone,
});

if (profileError) {
  // Roll the auth user back rather than leaving one that can sign in and then
  // immediately hit a missing profile.
  await admin.auth.admin.deleteUser(created.user.id);
  console.error(`Could not create profile: ${profileError.message}`);
  process.exit(1);
}

// The office's copy of the PIN (0044), shown in the person popup.
await admin.from("staff_pins").upsert({ profile_id: created.user.id, pin });

console.log(`Created ${role}  ${code}  ${name}`);
console.log(`  PIN  ${pin}`);
console.log(`  Sign in at /login with the code and PIN above.`);
