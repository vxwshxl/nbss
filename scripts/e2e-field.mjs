/**
 * End-to-end checks for field operations (0022_field_ops.sql), against the live
 * project, signed in as real throwaway accounts so every row-level policy and
 * security-definer rule applies exactly as it does on a phone.
 *
 *   pnpm test:field                 # creates, checks, deletes everything it made
 *   E2E_KEEP=1 pnpm test:field      # leave it all in place to look at in the console
 *
 * Covers: the phone (approval, a second guard on the same phone), check-in with
 * the device flag, the path uploaded in a batch with the phone's own times
 * (including points held while offline), the route-history read, replacement
 * (requested by the guard, assigned by a supervisor, and NOT re-created by the
 * nightly roster fill), shift types and 24-hour overtime, handover notes, an SOS
 * raised off duty and answered, and bookings by number of days. Email and push
 * are checked as queued rows; rows this run queued are deleted at the end.
 */

import { createClient } from "@supabase/supabase-js";

import { connect, readEnv } from "./db.mjs";

const env = readEnv();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const KEEP = process.env.E2E_KEEP === "1";

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const fresh = () => createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });

// Kokrajhar. 0.0003° of latitude is ~33 m: inside a 150 m fence.
const FENCE = { lat: 26.4014, lng: 90.2717, radius: 150 };
const at = (dLat, dLng = 0) => ({ lat: FENCE.lat + dLat, lng: FENCE.lng + dLng });

const tag = Date.now().toString(36).slice(-5);
const T = tag.toUpperCase();
// Not example.com, so email rows are actually queued and can be checked. The
// worker refuses reserved domains (.test), so nothing is ever sent to these.
const mail = (who) => `e2e-${who}-${tag}@nbss-e2e.test`;
const people = {
  sup: { code: `E2F-S${T}`, role: "supervisor", name: `E2E Supervisor ${tag}`, email: mail("sup"), password: `sup-pass-${tag}!` },
  a: { code: `E2F-A${T}`, role: "guard", name: `E2E Guard Asha ${tag}`, email: mail("a"), password: "482913" },
  b: { code: `E2F-B${T}`, role: "guard", name: `E2E Guard Bijoy ${tag}`, email: mail("b"), password: "739154" },
  client: { code: `E2F-C${T}`, role: "client", name: `E2E Client ${tag}`, email: mail("client"), password: `cli-pass-${tag}!` },
};

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
async function rpc(client, fn, args) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

const created = { users: [], sites: [] };
let firstEmail = 0;
let firstPush = 0;
let pg;

async function setup() {
  pg = await connect();
  firstEmail = Number((await pg.query("select coalesce(max(id), 0) m from email_outbox")).rows[0].m);
  firstPush = Number((await pg.query("select coalesce(max(id), 0) m from push_outbox")).rows[0].m);

  for (const p of Object.values(people)) {
    const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: p.password, email_confirm: true });
    if (error) throw new Error(`create ${p.code}: ${error.message}`);
    p.id = data.user.id;
    created.users.push(p.id);
    const { error: pe } = await admin
      .from("profiles")
      .insert({ id: p.id, employee_code: p.code, role: p.role, full_name: p.name, email: p.email, phone: "9000000000" });
    if (pe) throw new Error(`profile ${p.code}: ${pe.message}`);
  }

  const { data: site, error } = await admin
    .from("sites")
    .insert({
      name: `E2E Field Site ${tag}`,
      client_id: people.client.id,
      lat: FENCE.lat,
      lng: FENCE.lng,
      geofence_radius_m: FENCE.radius,
      max_accuracy_m: 100,
      grace_minutes: 30,
    })
    .select("id, name")
    .single();
  if (error) throw new Error(`site: ${error.message}`);
  created.sites.push(site.id);
  people.site = site;

  for (const key of ["sup", "a", "b", "client"]) {
    const c = fresh();
    const { error: se } = await c.auth.signInWithPassword({ email: people[key].email, password: people[key].password });
    if (se) throw new Error(`sign in ${key}: ${se.message}`);
    people[key].db = c;
  }
}

async function teardown() {
  if (pg) {
    if (!KEEP) {
      await pg.query("delete from email_outbox where id > $1", [firstEmail]);
      await pg.query("delete from push_outbox where id > $1 and profile_id = any($2)", [firstPush, created.users]);
    }
  }
  if (!KEEP) {
    for (const id of created.sites) await admin.from("sites").delete().eq("id", id);
    for (const id of created.users) await admin.auth.admin.deleteUser(id);
  }
  await pg?.end();
}

const emails = async (template) =>
  (await pg.query("select * from email_outbox where id > $1 and template = $2 order by id", [firstEmail, template])).rows;

async function run() {
  console.log(`Field operations E2E · run ${tag}\n`);
  await setup();
  const { a, b, sup, client, site } = people;
  const PHONE_A = `e2e-phone-a-${tag}`;
  const PHONE_X = `e2e-phone-x-${tag}`;

  console.log("Shift types");
  await check("the four shift types exist with the agreed times", async () => {
    const { data } = await a.db.from("shift_types").select("code, label, starts, ends").order("sort");
    const got = (data ?? []).map((t) => `${t.code} ${t.starts.slice(0, 5)}-${t.ends.slice(0, 5)}`).join(", ");
    assert(
      got === "morning 06:00-14:00, evening 14:00-22:00, night 22:00-06:00, full_day 06:00-06:00",
      got,
    );
  });

  console.log("The phone");
  await check("a guard's first phone is approved on the spot", async () => {
    const r = await rpc(a.db, "register_handset", {
      p_device_id: PHONE_A, p_platform: "android", p_brand: "Samsung", p_model: "Galaxy M14",
      p_os_version: "14", p_app_version: "1.0.0", p_battery: 81, p_charging: false,
      p_location_permission: "always", p_gps_enabled: true,
    });
    assert(r.status === "approved" && r.new === true, JSON.stringify(r));
  });
  await check("another guard signing in on that same phone is held as pending and named", async () => {
    const r = await rpc(b.db, "register_handset", { p_device_id: PHONE_A, p_platform: "android", p_brand: "Samsung", p_model: "Galaxy M14" });
    assert(r.status === "pending" && r.shared_with === a.name, JSON.stringify(r));
  });
  await check("staff are emailed about the new phone", async () => {
    const rows = await emails("device");
    assert(rows.some((r) => r.data.guard === b.name && r.data.shared_with === a.name), `${rows.length} device emails`);
  });
  await check("a guard cannot read another guard's devices", async () => {
    const { data } = await b.db.from("guard_devices").select("profile_id");
    assert((data ?? []).every((d) => d.profile_id === b.id), "saw someone else's phone");
  });

  console.log("Check-in and the path");
  const now = Date.now();
  // A morning shift around now for Asha.
  const { data: shiftA, error: se } = await admin
    .from("shifts")
    .insert({ site_id: site.id, guard_id: a.id, starts_at: new Date(now - 10 * 60_000).toISOString(), ends_at: new Date(now + 8 * 3600_000).toISOString(), shift_type: "morning" })
    .select("id")
    .single();
  if (se) throw new Error(se.message);

  let attA;
  await check("check-in from the guard's own phone is clean (no device flag)", async () => {
    const p = at(0.0003);
    const r = await rpc(a.db, "punch_in", { p_site_id: site.id, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 12, p_device_id: PHONE_A, p_battery: 80 });
    attA = r.attendance_id;
    assert(r.ok && r.device_flag === null && r.status === "present", JSON.stringify(r));
    // Backdated ten minutes, so the batches below have room between check-in and
    // now (the server clamps a phone's times into that window).
    const back = new Date(Date.now() - 10 * 60_000).toISOString();
    await admin.from("attendance").update({ check_in_at: back }).eq("id", attA);
    await admin.from("guard_location_history").update({ recorded_at: back }).eq("attendance_id", attA);
  });
  await check("the check-in point starts the trail", async () => {
    const t = await rpc(sup.db, "guard_trail", { p_attendance_id: attA });
    assert(t.points.length === 1 && t.points[0][7] === "check_in", JSON.stringify(t.points));
  });

  await check("a batch with the phone's own times is stored in order, offline points included", async () => {
    // Five points, 20 s apart, starting 1 min after check-in; the batch arrives
    // shuffled, as a queue flushed after a dead zone can.
    const base = Date.now() - 5 * 60_000 + 120_000;
    const pts = [0, 1, 2, 3, 4].map((i) => ({
      ...at(0.0003 + i * 0.0002, i * 0.0001),
      accuracy_m: 10,
      speed_mps: 1.2,
      battery: 79 - i,
      charging: false,
      at: base + i * 20_000 - 120_000,
    }));
    const r = await rpc(a.db, "record_positions", { p_points: [pts[3], pts[0], pts[4], pts[1], pts[2]], p_device_id: PHONE_A });
    assert(r.tracked && r.stored === 5, JSON.stringify(r));
    const t = await rpc(sup.db, "guard_trail", { p_attendance_id: attA });
    const times = t.points.map((x) => x[2]);
    assert(t.points.length === 6, `${t.points.length} points`);
    assert(times.every((x, i) => i === 0 || x >= times[i - 1]), "trail out of order");
  });
  await check("points closer than the cadence floor are dropped, not duplicated", async () => {
    const last = Date.now() - 2 * 60_000;
    const r = await rpc(a.db, "record_positions", {
      p_points: [{ ...at(0.001), accuracy_m: 8, at: last }, { ...at(0.001), accuracy_m: 8, at: last + 1000 }],
      p_device_id: PHONE_A,
    });
    assert(r.stored === 1, JSON.stringify(r));
  });
  await check("a point outside the fence is recorded as outside", async () => {
    const r = await rpc(a.db, "record_positions", { p_points: [{ ...at(0.01), accuracy_m: 15, at: Date.now() - 60_000, battery: 70 }], p_device_id: PHONE_A });
    assert(r.stored === 1 && r.inside_fence === false, JSON.stringify(r));
  });
  await check("the live position moves to the newest point, with battery and phone", async () => {
    const { data } = await sup.db.from("guard_positions").select("lat, battery, device_id, inside_fence").eq("guard_id", a.id).single();
    assert(data && data.battery === 70 && data.device_id === PHONE_A && data.inside_fence === false, JSON.stringify(data));
  });
  await check("the route can be read by staff and the guard, not by another guard", async () => {
    await rpc(a.db, "guard_trail", { p_attendance_id: attA });
    const { error } = await b.db.rpc("guard_trail", { p_attendance_id: attA });
    assert(error, "another guard read the route");
  });
  await check("a client cannot read guard positions", async () => {
    const { data } = await client.db.from("guard_location_history").select("id").limit(1);
    assert((data ?? []).length === 0, "client read the trail");
  });
  await check("the 15-second broadcast builds without error", async () => {
    await pg.query("select broadcast_positions()");
  });

  console.log("Someone else's phone");
  let attB;
  await check("a guard checking in on another guard's phone is let in but held for review", async () => {
    const p = at(0.0002);
    const r = await rpc(b.db, "punch_in", { p_site_id: site.id, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 10, p_device_id: PHONE_A });
    attB = r.attendance_id;
    assert(r.ok && r.device_flag === "shared_device" && r.status === "pending_review", JSON.stringify(r));
  });
  await check("the flagged punch says why", async () => {
    const { data } = await sup.db.from("attendance").select("review_note, device_flag").eq("id", attB).single();
    assert(data.device_flag === "shared_device" && /another guard/.test(data.review_note ?? ""), JSON.stringify(data));
  });
  await check("once a supervisor approves the phone the next check-in is clean", async () => {
    await rpc(b.db, "punch_out", { p_lat: FENCE.lat, p_lng: FENCE.lng, p_accuracy_m: 10 });
    await rpc(b.db, "register_handset", { p_device_id: PHONE_X, p_platform: "android", p_model: "Redmi 12" });
    // B's first own phone: B had no approved phone, so this one is approved.
    const { data } = await sup.db.from("guard_devices").select("status").eq("profile_id", b.id).eq("device_id", PHONE_X).single();
    assert(data.status === "approved", `phone X is ${data.status}`);
    const p = at(0.0002);
    const r = await rpc(b.db, "punch_in", { p_site_id: site.id, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 10, p_device_id: PHONE_X });
    assert(r.device_flag === null, JSON.stringify(r));
    await rpc(b.db, "punch_out", { p_lat: FENCE.lat, p_lng: FENCE.lng, p_accuracy_m: 10 });
  });

  console.log("Replacement");
  // A weekly morning posting for Asha writes her shifts for the coming week.
  const { data: posting, error: pe } = await admin
    .from("site_postings")
    .insert({ site_id: site.id, guard_id: a.id, starts: "06:00", ends: "14:00", days: [1, 2, 3, 4, 5, 6, 7], shift_type: "morning", created_by: sup.id })
    .select("id")
    .single();
  if (pe) throw new Error(pe.message);
  const { data: future } = await admin
    .from("shifts")
    .select("id, starts_at, ends_at, shift_type")
    .eq("guard_id", a.id)
    .eq("posting_id", posting.id)
    .gt("starts_at", new Date(Date.now() + 12 * 3600_000).toISOString())
    .order("starts_at")
    .limit(2);

  await check("a posting writes morning shifts carrying their type", async () => {
    assert((future ?? []).length === 2 && future.every((s) => s.shift_type === "morning"), JSON.stringify(future));
  });

  let requestId;
  await check("the guard asks for a replacement; staff are emailed", async () => {
    const r = await rpc(a.db, "request_replacement", { p_shift_id: future[0].id, p_reason: "Family function" });
    requestId = r.request_id;
    const rows = await emails("replacement_request");
    assert(rows.some((x) => x.data.guard === a.name && x.data.reason === "Family function"), `${rows.length} emails`);
  });
  await check("asking twice for the same duty is refused politely", async () => {
    const { error } = await a.db.rpc("request_replacement", { p_shift_id: future[0].id });
    assert(error && /already asked/.test(error.message), error?.message ?? "no error");
  });
  await check("a guard cannot assign replacements", async () => {
    const { error } = await a.db.rpc("assign_replacement", { p_shift_ids: [future[0].id], p_guard: b.id });
    assert(error, "guard assigned a replacement");
  });
  await check("a supervisor assigns Bijoy; Asha's shift is handed over, his is created", async () => {
    const r = await rpc(sup.db, "assign_replacement", { p_shift_ids: [future[0].id, future[1].id], p_guard: b.id, p_reason: "Family function", p_request_id: requestId });
    assert(r.count === 2, JSON.stringify(r));
    const { data: old } = await admin.from("shifts").select("status, replaced_by_shift").eq("id", future[0].id).single();
    assert(old.status === "cancelled" && old.replaced_by_shift, JSON.stringify(old));
    const { data: neu } = await admin.from("shifts").select("guard_id, replaces_shift, shift_type, starts_at").eq("id", old.replaced_by_shift).single();
    assert(neu.guard_id === b.id && neu.replaces_shift === future[0].id && neu.shift_type === "morning", JSON.stringify(neu));
    const { data: req } = await admin.from("replacement_requests").select("status, replacement_guard").eq("id", requestId).single();
    assert(req.status === "assigned" && req.replacement_guard === b.id, JSON.stringify(req));
  });
  await check("Bijoy is emailed his new duty", async () => {
    const rows = await emails("duty");
    assert(rows.some((x) => x.to_email === b.email && x.data.replacing === a.name && x.data.lines.length === 2), `${rows.length}`);
  });
  await check("the nightly roster fill does NOT write Asha's replaced shift back", async () => {
    await pg.query("select roster_fill_guard($1, 7)", [a.id]);
    await pg.query("select roster_fill(7)");
    const { data } = await admin
      .from("shifts")
      .select("id, status")
      .eq("guard_id", a.id)
      .eq("starts_at", future[0].starts_at);
    assert(data.length === 1 && data[0].status === "cancelled", JSON.stringify(data));
  });
  await check("editing Asha's posting keeps the handover in place", async () => {
    await admin.from("site_postings").update({ days: [1, 2, 3, 4, 5, 6, 7] }).eq("id", posting.id);
    const { data } = await admin.from("shifts").select("guard_id, status").eq("starts_at", future[0].starts_at).eq("site_id", site.id);
    const live = data.filter((s) => s.status !== "cancelled");
    assert(live.length === 1 && live[0].guard_id === b.id, JSON.stringify(data));
  });
  await check("each guard's duty list says who replaced whom", async () => {
    const mineA = await rpc(a.db, "my_duties", { p_days_back: 1, p_days_ahead: 8 });
    const mineB = await rpc(b.db, "my_duties", { p_days_back: 1, p_days_ahead: 8 });
    const handed = mineA.find((d) => d.id === future[0].id);
    assert(handed?.replaced_by === b.name && handed.request?.status === "assigned", JSON.stringify(handed));
    assert(mineB.some((d) => d.replacing === a.name && d.site.name === site.name), "B has no replacement duty");
  });
  await check("Bijoy's replacement duty is an ordinary rostered check-in for him", async () => {
    // Bring his first replacement shift to now, then check in.
    const { data: neu } = await admin.from("shifts").select("id").eq("replaces_shift", future[0].id).single();
    await admin.from("shifts").update({ starts_at: new Date(Date.now() - 5 * 60_000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString() }).eq("id", neu.id);
    const p = at(0.0001);
    const r = await rpc(b.db, "punch_in", { p_site_id: site.id, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 9, p_device_id: PHONE_X });
    assert(r.status === "present" && r.off_roster === false, JSON.stringify(r));
    const { data: s } = await admin.from("shifts").select("status").eq("id", neu.id).single();
    assert(s.status === "in_progress", s.status);
  });

  console.log("SOS");
  let alertId;
  await check("a guard who is NOT checked in can still raise an SOS", async () => {
    // Asha is still on duty; use the supervisor-free path with a fresh guard state:
    // check Asha out first so she is off duty.
    await rpc(a.db, "punch_out", { p_lat: FENCE.lat, p_lng: FENCE.lng, p_accuracy_m: 10, p_handover: "Gate 2 lock is broken, use the chain." });
    const p = at(0.002);
    const r = await rpc(a.db, "raise_sos", { p_kind: "medical", p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 20, p_note: "Fell from the steps" });
    alertId = r.alert_id;
    assert(r.alert_id && r.site_id === site.id, JSON.stringify(r));
  });
  await check("every staff member and the on-duty guard are on the alert", async () => {
    const { data } = await admin.from("sos_notifications").select("profile_id, audience").eq("alert_id", alertId);
    const ids = new Set(data.map((n) => n.profile_id));
    assert(ids.has(sup.id) && ids.has(b.id) && ids.has(client.id), JSON.stringify(data));
  });
  await check("staff are emailed the SOS with the location", async () => {
    const rows = await emails("sos");
    const mine = rows.filter((r) => r.data.alert_id === alertId);
    assert(mine.length >= 1 && mine.every((r) => r.data.lat && r.data.kind === "medical"), `${mine.length}`);
    assert(mine.some((r) => r.to_email === sup.email), "supervisor not emailed");
  });
  await check("pressing again re-notifies instead of opening a second alert", async () => {
    const r = await rpc(a.db, "raise_sos", { p_kind: "other" });
    assert(r.repeat === true && r.alert_id === alertId, JSON.stringify(r));
  });
  await check("the on-duty guard answers; the raiser sees who is coming", async () => {
    const p = at(0.0005);
    await rpc(b.db, "acknowledge_sos", { p_alert_id: alertId, p_response: "responding", p_lat: p.lat, p_lng: p.lng });
    const people_ = await rpc(a.db, "sos_people", { p_alert_id: alertId });
    const r = people_.find((x) => x.kind === "responder");
    assert(r?.full_name === b.name && r.distance_m > 0, JSON.stringify(people_));
    const { data } = await admin.from("sos_alerts").select("status, first_responder").eq("id", alertId).single();
    assert(data.status === "acknowledged" && data.first_responder === b.id, JSON.stringify(data));
  });
  await check("the supervisor closes it; it leaves the live set", async () => {
    await rpc(sup.db, "close_sos", { p_alert_id: alertId, p_status: "resolved", p_note: "Ambulance took her" });
    const { data } = await admin.from("sos_alerts").select("status, closed_by").eq("id", alertId).single();
    assert(data.status === "resolved" && data.closed_by === sup.id, JSON.stringify(data));
  });

  console.log("Handover, check-out, 24 hours");
  await check("Asha's check-out note is waiting for Bijoy on the same site", async () => {
    const { data } = await b.db.from("handover_notes").select("body, author_id").eq("site_id", site.id);
    assert(data?.some((n) => n.author_id === a.id && /Gate 2/.test(n.body)), JSON.stringify(data));
  });
  await check("the check-out point ends Asha's trail", async () => {
    const t = await rpc(sup.db, "guard_trail", { p_attendance_id: attA });
    assert(t.points.at(-1)[7] === "check_out" && t.check_out_at, JSON.stringify(t.points.at(-1)));
  });
  await check("a 24-hour shift is not counted as sixteen hours of overtime", async () => {
    await rpc(b.db, "punch_out", { p_lat: FENCE.lat, p_lng: FENCE.lng, p_accuracy_m: 10 });
    const start = new Date(Date.now() - 24 * 3600_000 - 3600_000);
    const { data: s } = await admin
      .from("shifts")
      .insert({ site_id: site.id, guard_id: b.id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 24 * 3600_000).toISOString(), shift_type: "full_day", status: "completed" })
      .select("id")
      .single();
    const { data: att, error } = await admin
      .from("attendance")
      .insert({ guard_id: b.id, site_id: site.id, shift_id: s.id, check_in_at: start.toISOString(), check_out_at: new Date(start.getTime() + 24.5 * 3600_000).toISOString(), check_in_method: "supervisor_override" })
      .select("worked_minutes, overtime_minutes")
      .single();
    if (error) throw new Error(error.message);
    assert(att.worked_minutes === 1470 && att.overtime_minutes === 30, JSON.stringify(att));
  });

  console.log("Watchdog");
  await check("the phone reports its battery saver, and the console can read it", async () => {
    await rpc(a.db, "register_handset", { p_device_id: PHONE_A, p_battery_optimized: true });
    const { data } = await sup.db.from("guard_devices").select("battery_optimized").eq("profile_id", a.id).eq("device_id", PHONE_A).single();
    assert(data.battery_optimized === true, JSON.stringify(data));
  });
  await check("a guard silent for 25 minutes gets a wake push; supervisors are told once", async () => {
    // Asha back on duty, with a phone that can receive push, then gone quiet.
    await admin.from("device_tokens").insert({ profile_id: a.id, token: `ExponentPushToken[e2e-${tag}]`, platform: "android" });
    const p = at(0.0003);
    const r = await rpc(a.db, "punch_in", { p_site_id: site.id, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 10, p_device_id: PHONE_A });
    const quiet = new Date(Date.now() - 25 * 60_000).toISOString();
    await admin.from("attendance").update({ check_in_at: quiet }).eq("id", r.attendance_id);
    await pg.query("delete from guard_positions where guard_id = $1", [a.id]);
    const first = (await pg.query("select check_silent_guards() r")).rows[0].r;
    assert(first.woken >= 1 && first.escalated >= 1, JSON.stringify(first));
    const pushes = (await pg.query("select title, data from push_outbox where id > $1 and profile_id = $2 order by id", [firstPush, a.id])).rows;
    assert(pushes.some((x) => x.title === null && x.data.type === "resume_tracking"), "no silent wake push");
    assert(pushes.some((x) => x.title === "Location sharing stopped"), "no visible push");
    const mails = await emails("silent");
    assert(mails.some((m) => m.data.guard === a.name), "supervisors not emailed");
    // A second run straight after does nothing new.
    const again = (await pg.query("select check_silent_guards() r")).rows[0].r;
    assert(again.woken === 0 && again.escalated === 0, JSON.stringify(again));
    // The phone speaks again, then falls silent again later: a new silence is a new alert.
    await rpc(a.db, "record_positions", { p_points: [{ ...at(0.0004), accuracy_m: 9, at: Date.now() - 1000 }], p_device_id: PHONE_A });
    const quiet2 = (await pg.query("select check_silent_guards() r")).rows[0].r;
    assert(quiet2.woken === 0, `woke a phone that is reporting: ${JSON.stringify(quiet2)}`);
    await rpc(a.db, "punch_out", { p_lat: p.lat, p_lng: p.lng, p_accuracy_m: 10 });
    await admin.from("device_tokens").delete().eq("profile_id", a.id);
  });

  console.log("Bookings");
  await check("a client books guards for a number of days and named shifts", async () => {
    const r = await rpc(client.db, "submit_service_request", {
      p_service_type: "event-security", p_contact_name: client.name, p_phone: "9000000000",
      p_guards_required: 4, p_start_date: "2026-11-10", p_days_required: 10, p_shift_types: ["night", "full_day", "bogus"],
      p_district: "Kokrajhar", p_source: "app",
    });
    const { data } = await client.db.from("service_requests").select("days_required, shift_types, end_date, shift_pattern").eq("id", r.id).single();
    assert(data.days_required === 10 && data.end_date === "2026-11-19", JSON.stringify(data));
    assert(JSON.stringify(data.shift_types) === JSON.stringify(["full_day", "night"]) && data.shift_pattern === "24x7", JSON.stringify(data));
    const rows = await emails("booking");
    assert(rows.some((x) => x.to_email === client.email && x.data.days === 10), "client not emailed");
    // Quoting it emails the client again.
    await admin.from("service_requests").update({ status: "quoted", quoted_amount_paise: 4_500_000 }).eq("id", r.id);
    const after = await emails("booking");
    assert(after.some((x) => x.data.status === "quoted" && x.data.quote_paise === 4500000), "no quote email");
    await admin.from("service_requests").delete().eq("id", r.id);
  });
}

try {
  await run();
} catch (e) {
  failed += 1;
  console.log(`\n  ✗ setup or run aborted: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await teardown().catch((e) => console.log(`teardown: ${e.message}`));
}

console.log(`\n${passed} passed, ${failed} failed${KEEP ? " (kept: E2E_KEEP=1)" : ""}`);
process.exit(failed ? 1 : 0);
