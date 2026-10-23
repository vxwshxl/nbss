/**
 * Walks a guard around a site, exactly as the app would: signs in, registers a
 * phone, checks in inside the fence, then sends location batches until stopped
 * (or for --minutes), and checks out. For demos and for testing the console's
 * Live tracking and Route history without a phone in a pocket.
 *
 *   node scripts/simulate-guard.mjs --code TEST-G1 --pin 111111 --site "Marriage event"
 *   node scripts/simulate-guard.mjs --code TEST-G2 --pin 222222 --site KGC --minutes 5 --wander 300
 *   node scripts/simulate-guard.mjs --code TEST-G1 --pin 111111 --sos     # raise an SOS mid-walk
 *
 * --every     seconds between batches (default 15, like a phone in a pocket)
 * --wander    how far from the gate the walk may go, in metres (default 220 —
 *             past a 150 m fence, so the route shows time outside)
 * --offline   hold points for this many batches then send them together, as a
 *             phone does after a dead zone (default 0)
 * --keep      stay checked in on exit
 */

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "./db.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args[a.slice(2)] = next;
    i++;
  } else args[a.slice(2)] = true;
}

const env = readEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

const code = String(args.code ?? "TEST-G1").toUpperCase();
const pin = String(args.pin ?? "111111");
const every = Number(args.every ?? 15) * 1000;
const wander = Number(args.wander ?? 220);
const minutes = args.minutes ? Number(args.minutes) : null;
const offline = Number(args.offline ?? 0);

const { data: profile } = await admin.from("profiles").select("id, full_name").eq("employee_code", code).single();
if (!profile) throw new Error(`No guard ${code}`);
const { data: u } = await admin.auth.admin.getUserById(profile.id);
const { error: signInError } = await db.auth.signInWithPassword({ email: u.user.email, password: pin });
if (signInError) throw new Error(`sign in: ${signInError.message}`);

const siteQuery = admin.from("sites").select("id, name, lat, lng, geofence_radius_m").eq("active", true);
const { data: sites } = args.site ? await siteQuery.ilike("name", `%${args.site}%`) : await siteQuery;
const site = sites?.[0];
if (!site) throw new Error(`No active site matching ${args.site ?? "(any)"}`);

const deviceId = `sim-${code.toLowerCase()}`;
const handset = await db.rpc("register_handset", {
  p_device_id: deviceId,
  p_platform: "android",
  p_brand: "Simulated",
  p_model: "Pocket phone",
  p_os_version: "14",
  p_app_version: "sim",
  p_battery: 92,
  p_charging: false,
  p_location_permission: "always",
  p_gps_enabled: true,
});
console.log(`${profile.full_name} · phone ${handset.data?.status ?? handset.error?.message}`);

const metres = (dLat, dLng, lat) => ({ dLat: dLat / 111_320, dLng: dLng / (111_320 * Math.cos((lat * Math.PI) / 180)) });

let pos = { lat: site.lat + metres(25, 0, site.lat).dLat, lng: site.lng };
let { data: open } = await db.from("attendance").select("id").is("check_out_at", null).maybeSingle();
if (!open) {
  const { data, error } = await db.rpc("punch_in", {
    p_site_id: site.id,
    p_lat: pos.lat,
    p_lng: pos.lng,
    p_accuracy_m: 9,
    p_device_id: deviceId,
    p_battery: 92,
  });
  if (error) throw new Error(`check in: ${error.message}`);
  console.log(`checked in at ${data.site_name} (${data.status})`);
} else {
  console.log("already checked in, carrying on");
}

let battery = 92;
let heading = Math.random() * 360;
let held = [];
let batches = 0;
let raised = false;
const started = Date.now();

async function step() {
  // A walk: mostly straight, turning now and then, pulled back toward the gate
  // when it strays past --wander.
  const toGate = Math.atan2(site.lat - pos.lat, site.lng - pos.lng) * (180 / Math.PI);
  const away = Math.hypot((pos.lat - site.lat) * 111_320, (pos.lng - site.lng) * 111_320 * Math.cos((site.lat * Math.PI) / 180));
  heading = away > wander ? 90 - toGate + (Math.random() - 0.5) * 40 : heading + (Math.random() - 0.5) * 70;

  const points = [];
  for (let i = 0; i < 3; i++) {
    const stride = 8 + Math.random() * 10;
    const m = metres(stride * Math.cos((heading * Math.PI) / 180), stride * Math.sin((heading * Math.PI) / 180), pos.lat);
    pos = { lat: pos.lat + m.dLat, lng: pos.lng + m.dLng };
    points.push({
      lat: pos.lat,
      lng: pos.lng,
      accuracy_m: 6 + Math.random() * 10,
      speed_mps: 1.1 + Math.random() * 0.6,
      heading: ((heading % 360) + 360) % 360,
      battery: Math.round(battery),
      charging: false,
      at: Date.now() - (2 - i) * (every / 3),
    });
  }
  battery = Math.max(5, battery - 0.15);

  held.push(...points);
  batches++;
  if (offline && batches % (offline + 1) !== 0) {
    console.log(`  offline, holding ${held.length} points`);
    return;
  }
  const { data, error } = await db.rpc("record_positions", { p_points: held, p_device_id: deviceId });
  if (error) console.log(`  record_positions: ${error.message}`);
  else {
    console.log(`  sent ${held.length}, stored ${data.stored} · ${data.inside_fence === false ? "OUTSIDE" : "inside"} · ${Math.round(away)} m from gate · ${Math.round(battery)}%`);
    if (data.tracked === false) {
      console.log(`  server stopped tracking: ${data.reason}`);
      process.exit(0);
    }
  }
  held = [];

  if (args.sos && !raised && Date.now() - started > every * 2) {
    raised = true;
    const r = await db.rpc("raise_sos", { p_kind: "intruder", p_lat: pos.lat, p_lng: pos.lng, p_accuracy_m: 10, p_note: "Simulated SOS" });
    console.log(`  SOS ${r.error ? r.error.message : `raised, ${r.data.notified} pushes queued`}`);
  }
}

let stopping = false;
async function finish() {
  if (stopping) return;
  stopping = true;
  if (!args.keep) {
    const { data, error } = await db.rpc("punch_out", { p_lat: pos.lat, p_lng: pos.lng, p_accuracy_m: 9 });
    console.log(error ? `check out: ${error.message}` : `checked out · ${data.worked_minutes} min`);
  }
  process.exit(0);
}
process.on("SIGINT", finish);
process.on("SIGTERM", finish);

await step();
const timer = setInterval(async () => {
  if (minutes && Date.now() - started > minutes * 60_000) {
    clearInterval(timer);
    await finish();
    return;
  }
  await step();
}, every);
