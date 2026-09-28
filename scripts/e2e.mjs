/**
 * End-to-end checks against the live project and a running web server.
 *
 *   pnpm dev                      # in another terminal
 *   pnpm test:e2e                 # or E2E_BASE_URL=https://… pnpm test:e2e
 *   E2E_KEEP=1 pnpm test:e2e      # leave the accounts in place for UI checks
 *
 * Creates throwaway accounts for every role (codes E2E-…, @example.com
 * addresses that never receive mail) and one fenced site, runs the checks, and
 * deletes everything it made — including on failure. No sign-in email is sent:
 * codes are minted with the admin API and verified through the real endpoint.
 */

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "./db.mjs";

const env = readEnv();
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const admin = createClient(URL_, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const fresh = () => createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });

// A fence in Kokrajhar. ~1.1 km north is well outside a 150 m radius.
const FENCE = { lat: 26.4014, lng: 90.2717, radius: 150 };
const INSIDE = { lat: FENCE.lat + 0.0003, lng: FENCE.lng };
const OUTSIDE = { lat: FENCE.lat + 0.01, lng: FENCE.lng };

const tag = Date.now().toString(36).slice(-5);
const people = {
  admin: { code: `E2E-A${tag.toUpperCase()}`, role: "admin", email: `e2e-admin-${tag}@example.com`, password: `adm-pass-${tag}!` },
  supervisor: { code: `E2E-S${tag.toUpperCase()}`, role: "supervisor", email: `e2e-sup-${tag}@example.com`, password: `sup-pass-${tag}!` },
  guard: { code: `E2E-G${tag.toUpperCase()}`, role: "guard", email: `e2e-guard-${tag}@example.com`, password: "482913" },
  guard2: { code: `E2E-H${tag.toUpperCase()}`, role: "guard", email: `e2e-guard2-${tag}@example.com`, password: "739154" },
  client: { code: `E2E-C${tag.toUpperCase()}`, role: "client", email: `e2e-client-${tag}@example.com`, password: `cli-pass-${tag}!` },
  otherClient: { code: `E2E-D${tag.toUpperCase()}`, role: "client", email: `e2e-client2-${tag}@example.com`, password: `cli2-pass-${tag}!` },
};

let passed = 0;
let failed = 0;
const results = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    results.push(`  ✗ ${name}\n      ${e instanceof Error ? e.message : String(e)}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function api(step, body) {
  const res = await fetch(`${BASE}/api/auth/${step}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function sessionFor(person) {
  const c = fresh();
  const { error } = await c.auth.signInWithPassword({ email: person.email, password: person.password });
  if (error) throw new Error(`sign-in for ${person.code}: ${error.message}`);
  return c;
}

const created = { users: [], sites: [], bookings: [] };

async function setup() {
  for (const p of Object.values(people)) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
    });
    if (error) throw new Error(`create ${p.code}: ${error.message}`);
    p.id = data.user.id;
    created.users.push(p.id);
    const { error: pe } = await admin.from("profiles").insert({
      id: p.id,
      employee_code: p.code,
      role: p.role,
      full_name: `E2E ${p.role} ${tag}`,
      email: p.email,
    });
    if (pe) throw new Error(`profile ${p.code}: ${pe.message}`);
  }

  const mk = async (name, clientId) => {
    const { data, error } = await admin
      .from("sites")
      .insert({
        name,
        client_id: clientId,
        lat: FENCE.lat,
        lng: FENCE.lng,
        geofence_radius_m: FENCE.radius,
        max_accuracy_m: 100,
        shift_start: "00:00",
        shift_end: "23:59",
        grace_minutes: 120,
      })
      .select("id")
      .single();
    if (error) throw new Error(`site: ${error.message}`);
    created.sites.push(data.id);
    return data.id;
  };
  people.site = await mk(`E2E Site ${tag}`, people.client.id);
  people.otherSite = await mk(`E2E Other ${tag}`, people.otherClient.id);
}

async function teardown() {
  for (const id of created.bookings) await admin.from("service_requests").delete().eq("id", id);
  // Attendance and shifts cascade from the sites and the profiles.
  for (const id of created.sites) await admin.from("sites").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  // The audit lines these accounts wrote are left: the log is append-only by design.
}

async function run() {
  console.log(`E2E against ${BASE} · run ${tag}\n`);
  await setup();

  // ── Sign-in: the one door ------------------------------------------------
  console.log("Sign-in");
  for (const key of ["admin", "supervisor", "guard", "client"]) {
    const p = people[key];
    await check(`${p.role} signs in with employee code + password and gets role "${p.role}"`, async () => {
      const r = await api("password", { identifier: p.code, secret: p.password });
      assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.body)}`);
      assert(r.body.role === p.role, `role ${r.body.role}`);
      assert(r.body.session?.access_token && r.body.session?.refresh_token, "no tokens");
    });
  }
  await check("sign-in by email address works too", async () => {
    const r = await api("password", { identifier: people.client.email.toUpperCase(), secret: people.client.password });
    assert(r.status === 200 && r.body.role === "client", `status ${r.status}`);
  });
  await check("wrong password and unknown account fail identically", async () => {
    const a = await api("password", { identifier: people.guard.code, secret: "000000" });
    const b = await api("password", { identifier: "NOBODY-999", secret: "000000" });
    assert(a.status === 401 && b.status === 401, `${a.status}/${b.status}`);
    assert(a.body.error === b.body.error, "messages differ — would reveal which codes exist");
  });
  await check("requesting a code for an unknown account looks like success", async () => {
    const r = await api("code", { identifier: `nobody-${tag}@example.com` });
    assert(r.status === 200 && r.body.ok === true, `status ${r.status}`);
  });
  await check("emailed code signs a guard in (verified via employee code)", async () => {
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: people.guard.email });
    if (error) throw error;
    const r = await api("verify", { identifier: people.guard.code, code: data.properties.email_otp });
    assert(r.status === 200 && r.body.role === "guard", `status ${r.status} ${JSON.stringify(r.body)}`);
  });
  await check("a used code cannot be replayed, a wrong code is refused", async () => {
    const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: people.client.email });
    const ok = await api("verify", { identifier: people.client.email, code: data.properties.email_otp });
    assert(ok.status === 200, `first use ${ok.status}`);
    const again = await api("verify", { identifier: people.client.email, code: data.properties.email_otp });
    assert(again.status === 401, `replay ${again.status}`);
    const wrong = await api("verify", { identifier: people.client.email, code: "000000" });
    assert(wrong.status === 401, `wrong ${wrong.status}`);
  });
  await check("a deactivated account cannot sign in", async () => {
    await admin.from("profiles").update({ active: false }).eq("id", people.guard2.id);
    const r = await api("password", { identifier: people.guard2.code, secret: people.guard2.password });
    await admin.from("profiles").update({ active: true }).eq("id", people.guard2.id);
    assert(r.status === 401, `status ${r.status}`);
  });
  await check("the web sign-in page and role redirects respond", async () => {
    const login = await fetch(`${BASE}/login`, { redirect: "manual" });
    assert(login.status === 200, `/login ${login.status}`);
    const legacy = await fetch(`${BASE}/console/login`, { redirect: "manual" });
    assert([307, 308].includes(legacy.status), `/console/login ${legacy.status}`);
    const gated = await fetch(`${BASE}/console/users`, { redirect: "manual" });
    assert([307, 308].includes(gated.status) && gated.headers.get("location")?.includes("/login"), "console not gated");
  });

  // ── Role isolation (RLS) -------------------------------------------------
  console.log("Role isolation");
  const s = {
    admin: await sessionFor(people.admin),
    supervisor: await sessionFor(people.supervisor),
    guard: await sessionFor(people.guard),
    guard2: await sessionFor(people.guard2),
    client: await sessionFor(people.client),
    otherClient: await sessionFor(people.otherClient),
  };

  await check("admin and supervisor can list every account (Users page)", async () => {
    for (const k of ["admin", "supervisor"]) {
      const { data, error } = await s[k].from("profiles").select("id").in("id", created.users);
      if (error) throw error;
      assert(data.length === created.users.length, `${k} saw ${data.length}/${created.users.length}`);
    }
  });
  await check("a guard sees only their own profile", async () => {
    const { data } = await s.guard.from("profiles").select("id").in("id", created.users);
    assert(data.length === 1 && data[0].id === people.guard.id, `saw ${data.length}`);
  });
  await check("a client sees only their own sites", async () => {
    const { data } = await s.client.from("sites").select("id").in("id", created.sites);
    assert(data.length === 1 && data[0].id === people.site, `saw ${data.length}`);
  });
  await check("a guard cannot change their own email or employee code", async () => {
    const { error } = await s.guard.from("profiles").update({ email: `hijack-${tag}@example.com` }).eq("id", people.guard.id);
    assert(error, "email change was allowed");
    const { error: e2 } = await s.guard.from("profiles").update({ employee_code: `X-${tag}` }).eq("id", people.guard.id);
    assert(e2, "code change was allowed");
  });
  await check("a guard can still edit their own name", async () => {
    const { error } = await s.guard.from("profiles").update({ full_name: `E2E guard ${tag} renamed` }).eq("id", people.guard.id);
    if (error) throw error;
  });
  await check("a guard cannot promote themselves", async () => {
    await s.guard.from("profiles").update({ role: "admin" }).eq("id", people.guard.id);
    const { data } = await admin.from("profiles").select("role").eq("id", people.guard.id).single();
    assert(data.role === "guard", `role is now ${data.role}`);
  });
  await check("changing an auth email syncs onto the profile", async () => {
    const next = `e2e-guard2-new-${tag}@example.com`;
    await admin.auth.admin.updateUserById(people.guard2.id, { email: next, email_confirm: true });
    const { data } = await admin.from("profiles").select("email").eq("id", people.guard2.id).single();
    assert(data.email === next, `profile email ${data.email}`);
    people.guard2.email = next;
  });

  // ── Sites & geofences --------------------------------------------------
  console.log("Sites");
  await check("an admin can register a site with a geofence", async () => {
    const { data, error } = await s.admin
      .from("sites")
      .insert({ name: `E2E Admin Site ${tag}`, lat: FENCE.lat, lng: FENCE.lng, geofence_radius_m: 120 })
      .select("id, geofence_radius_m")
      .single();
    if (error) throw error;
    created.sites.push(data.id);
    assert(data.geofence_radius_m === 120, "radius not stored");
  });
  await check("supervisors, guards and clients cannot create a site", async () => {
    for (const k of ["supervisor", "guard", "client"]) {
      const { error } = await s[k].from("sites").insert({ name: `nope ${k}`, lat: 1, lng: 1 });
      assert(error, `${k} created a site`);
    }
  });
  await check("nobody but an admin can move a fence", async () => {
    for (const k of ["supervisor", "guard", "client"]) {
      await s[k].from("sites").update({ lat: 0, lng: 0 }).eq("id", people.site);
    }
    const { data } = await admin.from("sites").select("lat").eq("id", people.site).single();
    assert(data.lat === FENCE.lat, `fence moved to ${data.lat}`);
  });
  await check("an impossible fence is rejected by the database", async () => {
    const { error } = await s.admin.from("sites").insert({ name: "bad", lat: 26.4, lng: 90.2, geofence_radius_m: 5 });
    assert(error, "a 5 m radius was accepted");
  });
  await check("guards can read the site list (to know where to report)", async () => {
    const { data } = await s.guard.from("sites").select("id").in("id", created.sites);
    assert(data.length >= 2, `guard saw ${data.length}`);
  });

  // ── Attendance + geofence ------------------------------------------------
  console.log("Attendance & geofence");
  const punchIn = (c, at, accuracy = 15, site = people.site) =>
    c.rpc("punch_in", { p_site_id: site, p_lat: at.lat, p_lng: at.lng, p_accuracy_m: accuracy });
  const punchOut = (c, at, accuracy = 15) =>
    c.rpc("punch_out", { p_lat: at.lat, p_lng: at.lng, p_accuracy_m: accuracy });

  // Listeners first, so the punches below are what they hear.
  const heard = { supervisor: [], guard2: [], client: [] };
  const sup = s.supervisor
    .channel(`e2e-sup-${tag}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (p) => heard.supervisor.push(p))
    .subscribe();
  const g2 = s.guard2
    .channel(`e2e-g2-${tag}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, (p) => heard.guard2.push(p))
    .subscribe();
  await s.client.realtime.setAuth();
  const cli = s.client
    .channel(`client:${people.client.id}`, { config: { private: true } })
    .on("broadcast", { event: "attendance" }, (p) => heard.client.push(p))
    .subscribe();
  await new Promise((r) => setTimeout(r, 3000));

  await check("check-in outside the fence is refused with the distance", async () => {
    const { error } = await punchIn(s.guard, OUTSIDE);
    assert(error && /outside/.test(error.message), error?.message ?? "was allowed");
  });
  await check("check-in with a poor GPS fix is refused", async () => {
    const { error } = await punchIn(s.guard, INSIDE, 400);
    assert(error && /accurate/.test(error.message), error?.message ?? "was allowed");
  });
  await check("staff cannot check themselves in", async () => {
    const { error } = await punchIn(s.supervisor, INSIDE);
    assert(error && /Only a guard/.test(error.message), error?.message ?? "was allowed");
  });
  await check("check-in inside the fence succeeds", async () => {
    const { data, error } = await punchIn(s.guard, INSIDE);
    if (error) throw error;
    assert(["present", "late"].includes(data.status), `status ${data.status}`);
  });
  await check("a second check-in while on duty is refused", async () => {
    const { error } = await punchIn(s.guard, INSIDE);
    assert(error && /already checked in/.test(error.message), error?.message ?? "was allowed");
  });
  await check("the open punch records distance, accuracy and method", async () => {
    const { data } = await admin
      .from("attendance")
      .select("check_in_distance_m, check_in_accuracy_m, check_in_method, check_out_at")
      .eq("guard_id", people.guard.id)
      .single();
    assert(data.check_in_distance_m < FENCE.radius, `distance ${data.check_in_distance_m}`);
    assert(data.check_in_accuracy_m === 15 && data.check_in_method === "geofence", "evidence missing");
    assert(data.check_out_at === null, "already closed");
  });
  await check("the guard sees their own punch; another guard does not", async () => {
    const own = await s.guard.from("attendance").select("id").eq("guard_id", people.guard.id);
    const other = await s.guard2.from("attendance").select("id").eq("guard_id", people.guard.id);
    assert(own.data.length === 1, `own ${own.data.length}`);
    assert(other.data.length === 0, `other guard saw ${other.data.length}`);
  });
  await check("the client sees the guard on duty at their site, without coordinates", async () => {
    const { data, error } = await s.client.from("client_attendance").select("*").eq("site_id", people.site);
    if (error) throw error;
    assert(data.length === 1, `rows ${data.length}`);
    assert(!("check_in_lat" in data[0]), "coordinates exposed to client");
  });
  await check("another client does not see it", async () => {
    const other = await sessionFor(people.otherClient);
    const { data } = await other.from("client_attendance").select("id").eq("site_id", people.site);
    assert(data.length === 0, `saw ${data.length}`);
  });
  await check("check-out works even away from the gate, and records the distance", async () => {
    const { error } = await punchOut(s.guard, OUTSIDE);
    if (error) throw error;
    const { data } = await admin
      .from("attendance")
      .select("check_out_at, check_out_distance_m, worked_minutes")
      .eq("guard_id", people.guard.id)
      .single();
    assert(data.check_out_at && data.check_out_distance_m > FENCE.radius, "not recorded");
    assert(typeof data.worked_minutes === "number", "worked minutes not computed");
  });
  await check("a deactivated site refuses check-in", async () => {
    await admin.from("sites").update({ active: false }).eq("id", people.otherSite);
    const { error } = await punchIn(s.guard2, INSIDE, 15, people.otherSite);
    await admin.from("sites").update({ active: true }).eq("id", people.otherSite);
    assert(error && /not in service/.test(error.message), error?.message ?? "was allowed");
  });
  await check("checking out twice is refused", async () => {
    const { error } = await punchOut(s.guard, INSIDE);
    assert(error && /not checked in/.test(error.message), error?.message ?? "was allowed");
  });

  // ── Roster (hybrid) -------------------------------------------------------
  console.log("Roster");
  const hhmm = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const postFrom = hhmm(new Date(Date.now() - 30 * 60_000));
  const postTo = hhmm(new Date(Date.now() + 7 * 3_600_000));

  await check("with no posts anywhere, check-in stays first come, first served", async () => {
    const { data } = await admin.from("attendance").select("off_roster, status").eq("guard_id", people.guard.id).single();
    assert(data.off_roster === false && data.status !== "pending_review", JSON.stringify(data));
  });
  await check("a guard cannot post themselves", async () => {
    const { error } = await s.guard
      .from("site_postings")
      .insert({ site_id: people.site, guard_id: people.guard.id, starts: postFrom, ends: postTo });
    assert(error, "was allowed");
  });
  await check("a supervisor posts a guard, and the week's shifts are written from it", async () => {
    const { error } = await s.supervisor
      .from("site_postings")
      .insert({ site_id: people.site, guard_id: people.guard.id, starts: postFrom, ends: postTo });
    if (error) throw error;
    const { data } = await admin.from("shifts").select("id, site_id, posting_id").eq("guard_id", people.guard.id);
    assert(data.length >= 7 && data.every((x) => x.posting_id && x.site_id === people.site), `${data.length} shifts`);
  });
  await check("the guard sees their own post; another guard does not", async () => {
    const mine = await s.guard.from("site_postings").select("id");
    const theirs = await s.guard2.from("site_postings").select("id");
    assert(mine.data?.length === 1 && theirs.data?.length === 0, `${mine.data?.length} / ${theirs.data?.length}`);
  });
  await check("checking in at your post is an ordinary punch, linked to the shift", async () => {
    const { data, error } = await punchIn(s.guard, INSIDE);
    if (error) throw error;
    assert(data.off_roster === false && data.status !== "pending_review", JSON.stringify(data));
    const { data: row } = await admin.from("attendance").select("shift_id, shifts(status)").eq("id", data.attendance_id).single();
    assert(row.shift_id && row.shifts.status === "in_progress", JSON.stringify(row));
    await punchOut(s.guard, INSIDE);
  });
  await check("checking in somewhere else still works, but is held for review", async () => {
    const { data, error } = await punchIn(s.guard, INSIDE, 15, people.otherSite);
    if (error) throw error;
    assert(data.off_roster === true && data.status === "pending_review", JSON.stringify(data));
    await punchOut(s.guard, INSIDE);
  });
  await check("a guard with no post at a rostered site is also held for review", async () => {
    const { data, error } = await punchIn(s.guard2, INSIDE);
    if (error) throw error;
    assert(data.off_roster === true, JSON.stringify(data));
    await punchOut(s.guard2, INSIDE);
  });
  await check("moving a post withdraws its future shifts and writes new ones", async () => {
    const { error } = await s.supervisor
      .from("site_postings")
      .update({ site_id: people.otherSite })
      .eq("guard_id", people.guard.id);
    if (error) throw error;
    const { data } = await admin
      .from("shifts")
      .select("site_id, status, starts_at")
      .eq("guard_id", people.guard.id)
      .eq("status", "scheduled")
      .gt("starts_at", new Date().toISOString());
    assert(data.length > 0 && data.every((x) => x.site_id === people.otherSite), JSON.stringify(data.slice(0, 2)));
  });
  await check("a rostered shift nobody came to becomes 'missed'", async () => {
    const { data: shift, error } = await admin
      .from("shifts")
      .insert({
        site_id: people.site,
        guard_id: people.guard2.id,
        starts_at: new Date(Date.now() - 20 * 3_600_000).toISOString(),
        ends_at: new Date(Date.now() - 12 * 3_600_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: e2 } = await admin.rpc("roster_mark_missed");
    if (e2) throw e2;
    const { data } = await admin.from("shifts").select("status").eq("id", shift.id).single();
    assert(data.status === "missed", data.status);
  });
  await check("nobody signed in can run the roster's or the push sender's internals", async () => {
    const a = await s.guard.rpc("roster_fill", { p_days: 7 });
    const b = await fresh().rpc("get_secret", { p_name: "expo_access_token" });
    const c = await s.client.rpc("set_secret", { p_name: "x", p_value: "y" });
    assert(a.error && b.error && c.error, "an internal function was callable");
  });

  // ── SOS ------------------------------------------------------------------
  console.log("SOS");
  await check("a guard who is not on duty cannot raise an SOS", async () => {
    const { error } = await s.guard.rpc("raise_sos", { p_kind: "intruder", p_lat: INSIDE.lat, p_lng: INSIDE.lng, p_accuracy_m: 12 });
    assert(error && /not checked in/.test(error.message), error?.message ?? "was allowed");
  });
  let alertId = null;
  await check("an on-duty guard raises an SOS, and staff and the site's client are alerted", async () => {
    const { error: pe } = await punchIn(s.guard2, INSIDE);
    if (pe) throw pe;
    const { data, error } = await s.guard2.rpc("raise_sos", { p_kind: "intruder", p_lat: INSIDE.lat, p_lng: INSIDE.lng, p_accuracy_m: 12 });
    if (error) throw error;
    alertId = data.alert_id;
    const { data: n } = await admin.from("sos_notifications").select("profile_id, audience").eq("alert_id", alertId);
    const who = new Set(n.map((x) => x.profile_id));
    assert(who.has(people.supervisor.id) && who.has(people.admin.id) && who.has(people.client.id), JSON.stringify(n));
  });
  await check("the alert is visible to staff and its client, not to another client", async () => {
    const staff = await s.supervisor.from("sos_alerts").select("id").eq("id", alertId);
    const owner = await s.client.from("sos_alerts").select("id").eq("id", alertId);
    const other = await s.otherClient.from("sos_alerts").select("id").eq("id", alertId);
    assert(staff.data.length === 1 && owner.data.length === 1 && other.data.length === 0, "wrong visibility");
  });
  await check("a supervisor answers 'on the way', and the guard can see it", async () => {
    const { error } = await s.supervisor.rpc("acknowledge_sos", { p_alert_id: alertId, p_response: "responding" });
    if (error) throw error;
    const { data } = await s.guard2.from("sos_acknowledgements").select("response").eq("alert_id", alertId);
    assert(data.length === 1 && data[0].response === "responding", JSON.stringify(data));
  });
  await check("another client cannot close someone else's alert", async () => {
    const { error } = await s.otherClient.rpc("close_sos", { p_alert_id: alertId, p_status: "resolved" });
    assert(error, "was allowed");
  });
  await check("staff close it as resolved", async () => {
    const { error } = await s.supervisor.rpc("close_sos", { p_alert_id: alertId, p_status: "resolved", p_note: "e2e" });
    if (error) throw error;
    const { data } = await admin.from("sos_alerts").select("status, closed_by").eq("id", alertId).single();
    assert(data.status === "resolved" && data.closed_by === people.supervisor.id, JSON.stringify(data));
    await punchOut(s.guard2, INSIDE);
  });

  // ── Realtime -------------------------------------------------------------
  console.log("Realtime");
  await new Promise((r) => setTimeout(r, 2500));
  await check("staff receive attendance changes live", async () => {
    assert(heard.supervisor.length >= 2, `supervisor heard ${heard.supervisor.length} events`);
  });
  await check("another guard receives none of them (RLS on the change feed)", async () => {
    // Their own punches (the roster and SOS checks above) they may hear; anyone else's, never.
    const others = heard.guard2.filter((p) => (p.new?.guard_id ?? p.old?.guard_id) !== people.guard2.id);
    assert(others.length === 0, `guard2 heard ${others.length} of other guards' rows`);
  });
  await check("the client's private doorbell rings for their site", async () => {
    assert(heard.client.length >= 1, `client heard ${heard.client.length}`);
    assert(heard.client[0].payload?.site_id === people.site, "wrong site");
  });
  for (const ch of [sup, g2, cli]) await ch.unsubscribe();

  // ── Bookings (client → desk) ----------------------------------------------
  console.log("Bookings");
  let booking;
  await check("a client books guards and gets a reference", async () => {
    const { data, error } = await s.client.rpc("submit_service_request", {
      p_service_type: "hospital-security",
      p_contact_name: "E2E Client",
      p_phone: "9864012345",
      p_district: "Kokrajhar",
      p_site_type: "Nursing home, 2 gates",
      p_guards_required: 4,
      p_shift_pattern: "24x7",
      p_source: "web",
    });
    if (error) throw error;
    assert(/^SR-\d{4}-\d{4}$/.test(data.reference), `reference ${data.reference}`);
    booking = data;
    created.bookings = [data.id];
  });
  await check("the client sees their own booking; another client does not", async () => {
    const own = await s.client.from("service_requests").select("id").eq("id", booking.id);
    const other = await (await sessionFor(people.otherClient)).from("service_requests").select("id").eq("id", booking.id);
    assert(own.data.length === 1, `own ${own.data.length}`);
    assert(other.data.length === 0, `other client saw ${other.data.length}`);
  });
  await check("guards cannot see bookings", async () => {
    const { data } = await s.guard.from("service_requests").select("id").eq("id", booking.id);
    assert(data.length === 0, `guard saw ${data.length}`);
  });
  await check("staff see it and can quote it; the client sees the quote", async () => {
    const { error } = await s.supervisor
      .from("service_requests")
      .update({ status: "quoted", quoted_amount_paise: 8400000, quote_note: "4 guards 24x7" })
      .eq("id", booking.id);
    if (error) throw error;
    const { data } = await s.client.from("service_requests").select("status, quoted_amount_paise").eq("id", booking.id).single();
    assert(data.status === "quoted" && data.quoted_amount_paise === 8400000, JSON.stringify(data));
  });
  await check("a client cannot change a booking's status directly", async () => {
    await s.client.from("service_requests").update({ status: "accepted" }).eq("id", booking.id);
    const { data } = await admin.from("service_requests").select("status").eq("id", booking.id).single();
    assert(data.status === "quoted", `status became ${data.status}`);
  });
  await check("the client can withdraw a quoted booking", async () => {
    const { error } = await s.client.rpc("withdraw_service_request", { p_id: booking.id });
    if (error) throw error;
    const { data } = await admin.from("service_requests").select("status").eq("id", booking.id).single();
    assert(data.status === "withdrawn", data.status);
  });
  await check("anonymous visitors cannot book", async () => {
    const { error } = await fresh().rpc("submit_service_request", { p_service_type: "x", p_contact_name: "x", p_phone: "1" });
    assert(error, "anonymous booking was accepted");
  });

  // ── Self-registration --------------------------------------------------
  console.log("Registration");
  await check("a self-registered account is always a client, whatever it asks for", async () => {
    const email = `e2e-selfreg-${tag}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { signup: "client", full_name: "Self Reg", phone: "9864000000", role: "admin" },
    });
    if (error) throw error;
    created.users.push(data.user.id);
    const { data: p } = await admin.from("profiles").select("role, email, employee_code").eq("id", data.user.id).single();
    assert(p.role === "client", `role ${p.role}`);
    assert(p.email === email && /^CL-\d{6}$/.test(p.employee_code), JSON.stringify(p));
  });
}

try {
  await run();
} catch (e) {
  failed += 1;
  results.push(`  ✗ setup/run aborted: ${e instanceof Error ? e.message : e}`);
} finally {
  if (process.env.E2E_KEEP) {
    // For clicking through the UI as each role afterwards. Delete them later by
    // running without E2E_KEEP, or from the Users page.
    results.push("\n  Fixtures kept (E2E_KEEP):");
    for (const p of Object.values(people)) {
      if (p && typeof p === "object" && p.code) results.push(`    ${p.role.padEnd(10)} ${p.code.padEnd(12)} ${p.password}`);
    }
  } else {
    await teardown().catch((e) => results.push(`  ! teardown: ${e.message}`));
  }
  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
