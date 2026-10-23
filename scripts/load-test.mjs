/**
 * Load test for field tracking: N guards on M sites around Kokrajhar, each one
 * signed in as itself, checked in from its own phone, walking and sending
 * location batches exactly as the app does, while you watch Live tracking.
 *
 *   node scripts/load-test.mjs --guards 80 --sites 12 --minutes 10
 *   node scripts/load-test.mjs --cleanup          # delete every LOAD-* guard and Load site
 *
 * Mixed on purpose, so the console has something to show: most guards stay
 * inside their fence, ~15% wander out, two run their battery down, two go
 * silent half-way (No signal), one checks in on another guard's phone, and one
 * raises an SOS (unless --no-sos). Prints round-trip times for record_positions.
 *
 * Accounts: LOAD-G001…, PIN 600001…; sites "Load site 01"…. Re-running reuses them.
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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const client = () => createClient(URL_, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: true } });

const N = Number(args.guards ?? 80);
const M = Number(args.sites ?? 12);
const MINUTES = Number(args.minutes ?? 10);
const EVERY = 15_000;
const CENTRE = { lat: 26.4015, lng: 90.2717 };

const FIRST = ["Ranjit", "Bijoy", "Dimbeswar", "Gwthwm", "Hemanta", "Jwngdao", "Khanindra", "Lwkhwi", "Mithinga", "Nabin", "Pradip", "Raju", "Sansuma", "Swmkhwr", "Thaigra", "Upen", "Bwisagu", "Daoharu", "Fwrmai", "Gautam"];
const LAST = ["Basumatary", "Narzary", "Brahma", "Daimary", "Boro", "Mushahary", "Swargiary", "Ramchiary", "Islary", "Goyary", "Hajowary", "Wary"];

const m2deg = (dy, dx, lat) => ({ dLat: dy / 111_320, dLng: dx / (111_320 * Math.cos((lat * Math.PI) / 180)) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
  const { data: people } = await admin.from("profiles").select("id").like("employee_code", "LOAD-%");
  const { data: sites } = await admin.from("sites").select("id").like("name", "Load site %");
  for (const s of sites ?? []) await admin.from("sites").delete().eq("id", s.id);
  for (const p of people ?? []) await admin.auth.admin.deleteUser(p.id);
  console.log(`removed ${people?.length ?? 0} guards and ${sites?.length ?? 0} sites`);
}

if (args.cleanup) {
  await cleanup();
  process.exit(0);
}

// ---------------------------------------------------------------- sites
const sites = [];
for (let i = 0; i < M; i++) {
  const name = `Load site ${String(i + 1).padStart(2, "0")}`;
  const angle = (i / M) * 2 * Math.PI;
  const r = 800 + (i % 3) * 1200;
  const d = m2deg(Math.sin(angle) * r, Math.cos(angle) * r, CENTRE.lat);
  const { data: found } = await admin.from("sites").select("id, name, lat, lng, geofence_radius_m").eq("name", name).maybeSingle();
  if (found) {
    sites.push(found);
    continue;
  }
  const { data, error } = await admin
    .from("sites")
    .insert({ name, client_name: "Load test", district: "Kokrajhar", lat: CENTRE.lat + d.dLat, lng: CENTRE.lng + d.dLng, geofence_radius_m: 150, max_accuracy_m: 100, grace_minutes: 30 })
    .select("id, name, lat, lng, geofence_radius_m")
    .single();
  if (error) throw new Error(`site: ${error.message}`);
  sites.push(data);
}
console.log(`${sites.length} sites ready`);

// ---------------------------------------------------------------- guards
const guards = [];
for (let i = 0; i < N; i++) {
  const code = `LOAD-G${String(i + 1).padStart(3, "0")}`;
  const pin = String(600001 + i);
  const email = `${code.toLowerCase()}@staff.nbss.co.in`;
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  let { data: p } = await admin.from("profiles").select("id").eq("employee_code", code).maybeSingle();
  if (!p) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: pin, email_confirm: true });
    if (error) throw new Error(`${code}: ${error.message}`);
    const { error: pe } = await admin.from("profiles").insert({ id: data.user.id, employee_code: code, role: "guard", full_name: name, phone: `90000${String(10000 + i)}` });
    if (pe) throw new Error(`${code}: ${pe.message}`);
    p = { id: data.user.id };
  }
  guards.push({ i, code, pin, email, name, id: p.id, site: sites[i % sites.length] });
}
console.log(`${guards.length} guards ready, signing in…`);

// Sign-ins are paced: the auth server allows a burst of ~30 then one every 2 s per address.
let signed = 0;
for (const g of guards) {
  g.db = client();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await g.db.auth.signInWithPassword({ email: g.email, password: g.pin });
    if (!error) break;
    if (!/rate|too many/i.test(error.message)) throw new Error(`${g.code}: ${error.message}`);
    await sleep(2500);
  }
  signed++;
  if (signed % 10 === 0) console.log(`  ${signed} signed in`);
  if (signed > 25) await sleep(2100);
}

// ---------------------------------------------------------------- check in
const SHARED = guards[guards.length - 1];
for (const g of guards) {
  g.device = g === SHARED ? `load-phone-${guards[0].code}` : `load-phone-${g.code}`;
  await g.db.rpc("register_handset", {
    p_device_id: g.device,
    p_platform: "android",
    p_brand: ["Samsung", "Redmi", "Vivo", "Realme", "Oppo"][g.i % 5],
    p_model: ["Galaxy M14", "Note 12", "Y16", "C55", "A58"][g.i % 5],
    p_os_version: String(12 + (g.i % 3)),
    p_app_version: "1.0.0",
    p_battery: 60 + (g.i % 40),
    p_charging: false,
    p_location_permission: g.i % 17 === 5 ? "foreground" : "always",
    p_gps_enabled: true,
  });
  const ang = Math.random() * 2 * Math.PI;
  const d = m2deg(Math.sin(ang) * 40, Math.cos(ang) * 40, g.site.lat);
  g.pos = { lat: g.site.lat + d.dLat, lng: g.site.lng + d.dLng };
  g.heading = Math.random() * 360;
  g.battery = g.i % 37 === 3 ? 18 : 55 + (g.i % 45);
  g.wanderM = g.i % 7 === 0 ? 350 : 110;
  g.silentAt = g.i % 41 === 9 ? Date.now() + (MINUTES * 60_000) / 2 : Infinity;
  const { data: open } = await g.db.from("attendance").select("id").is("check_out_at", null).maybeSingle();
  if (!open) {
    const { error } = await g.db.rpc("punch_in", { p_site_id: g.site.id, p_lat: g.pos.lat, p_lng: g.pos.lng, p_accuracy_m: 10, p_device_id: g.device, p_battery: g.battery });
    if (error) console.log(`  ${g.code} check-in: ${error.message}`);
  }
}
console.log(`all checked in · walking for ${MINUTES} min · open /console/live`);

// ---------------------------------------------------------------- walk
const times = [];
let errors = 0;
let stored = 0;

async function step(g) {
  if (Date.now() > g.silentAt) return;
  const away = Math.hypot((g.pos.lat - g.site.lat) * 111_320, (g.pos.lng - g.site.lng) * 111_320 * Math.cos((g.site.lat * Math.PI) / 180));
  const toSite = (Math.atan2((g.site.lat - g.pos.lat) * 111_320, (g.site.lng - g.pos.lng) * 111_320 * Math.cos((g.site.lat * Math.PI) / 180)) * 180) / Math.PI;
  g.heading = away > g.wanderM ? toSite + (Math.random() - 0.5) * 50 : g.heading + (Math.random() - 0.5) * 80;
  const points = [];
  for (let k = 0; k < 2; k++) {
    const stride = Math.random() < 0.3 ? 2 : 8 + Math.random() * 10;
    const d = m2deg(stride * Math.sin((g.heading * Math.PI) / 180), stride * Math.cos((g.heading * Math.PI) / 180), g.pos.lat);
    g.pos = { lat: g.pos.lat + d.dLat, lng: g.pos.lng + d.dLng };
    points.push({ lat: g.pos.lat, lng: g.pos.lng, accuracy_m: 6 + Math.random() * 14, speed_mps: stride / 7.5, battery: Math.round(g.battery), charging: false, at: Date.now() - (1 - k) * 7_500 });
  }
  g.battery = Math.max(3, g.battery - (g.i % 37 === 3 ? 0.6 : 0.05));
  const t0 = performance.now();
  const { data, error } = await g.db.rpc("record_positions", { p_points: points, p_device_id: g.device });
  times.push(performance.now() - t0);
  if (error) {
    errors++;
    if (errors < 5) console.log(`  ${g.code}: ${error.message}`);
  } else stored += data?.stored ?? 0;
}

const started = Date.now();
let sos = false;
const timers = guards.map((g, idx) =>
  setTimeout(() => {
    void step(g);
    g.timer = setInterval(() => void step(g), EVERY);
  }, (idx / guards.length) * EVERY),
);

const report = setInterval(async () => {
  const sorted = [...times].sort((a, b) => a - b);
  const pct = (p) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]) : 0);
  console.log(`  ${Math.round((Date.now() - started) / 1000)} s · ${times.length} batches · ${stored} points stored · p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms · ${errors} errors`);
  times.length = 0;
  if (!sos && !args["no-sos"] && Date.now() - started > 60_000) {
    sos = true;
    const g = guards[3];
    const r = await g.db.rpc("raise_sos", { p_kind: "intruder", p_lat: g.pos.lat, p_lng: g.pos.lng, p_accuracy_m: 12, p_note: "Load test SOS" });
    console.log(`  SOS by ${g.name}: ${r.error ? r.error.message : `${r.data.notified} pushes queued`}`);
  }
}, 30_000);

async function finish() {
  clearInterval(report);
  timers.forEach(clearTimeout);
  guards.forEach((g) => clearInterval(g.timer));
  if (!args.keep) {
    console.log("checking everyone out…");
    for (const g of guards) await g.db.rpc("punch_out", { p_lat: g.pos.lat, p_lng: g.pos.lng, p_accuracy_m: 10 });
  }
  console.log("done");
  process.exit(0);
}
process.on("SIGINT", finish);
process.on("SIGTERM", finish);
setTimeout(finish, MINUTES * 60_000);
