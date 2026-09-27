/**
 * Demo data for the film: a small, believable agency — an administrator, a
 * supervisor, nine guards, two clients, three fenced sites, a month of
 * attendance and a couple of bookings.
 *
 *   node scripts/demo-data.mjs seed       # before capturing
 *   node scripts/demo-data.mjs teardown   # after — removes every row it made
 *
 * Everything is fictional — the people, and client businesses whose domains are
 * not registered to anyone — on NBSS-9xx / CL-009xxx codes the real sequences
 * do not reach. Accounts are created confirmed, so nothing is ever emailed. What was
 * created is written to .demo-state.json so teardown removes exactly that.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { readEnv } from "../../../scripts/db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STATE_FILE = path.join(HERE, "..", ".demo-state.json");

const env = readEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

export const PEOPLE = {
  admin: { code: "NBSS-900", role: "admin", name: "Anita Boro", email: "anita.boro@nbss.co.in", password: "Demo-Admin-2026", phone: "98640 11200" },
  supervisor: { code: "NBSS-950", role: "supervisor", name: "Ranjit Brahma", email: "ranjit.brahma@nbss.co.in", password: "Demo-Super-2026", phone: "98640 11250" },
  guard: { code: "NBSS-907", role: "guard", name: "Rakesh Narzary", email: "rakesh.narzary@nbss.co.in", password: "482913", phone: "98640 11907" },
  clientA: { code: "CL-009001", role: "client", name: "Aronai Agro Foods", email: "office@aronaiagro.in", password: "Demo-Client-2026", phone: "98640 22001" },
  clientB: { code: "CL-009002", role: "client", name: "Dwisa Care Hospital", email: "admin@dwisacare.in", password: "Demo-Client-2026b", phone: "98640 22002" },
};

const CREW = [
  ["NBSS-901", "Bikram Basumatary"],
  ["NBSS-902", "Dipika Narzary"],
  ["NBSS-903", "Sanjib Daimary"],
  ["NBSS-904", "Jwngsar Mwshahary"],
  ["NBSS-905", "Hemanta Boro"],
  ["NBSS-906", "Mridul Swargiary"],
  ["NBSS-908", "Pinky Goyari"],
  ["NBSS-909", "Raju Ramchiary"],
];

// Around Kokrajhar town. The new site the film registers is placed live.
const SITES = [
  { key: "warehouse", name: "Aronai Agro Foods — warehouse gate", client: "clientA", district: "Kokrajhar", address: "Saraibil industrial area", lat: 26.4131, lng: 90.2598, r: 180 },
  { key: "hospital", name: "Dwisa Care Hospital — emergency block", client: "clientB", district: "Kokrajhar", address: "Titaguri, NH-31C", lat: 26.3902, lng: 90.2861, r: 150 },
  { key: "terminal", name: "Gwdan Market Complex — north gate", client: null, district: "Kokrajhar", address: "Station road", lat: 26.4046, lng: 90.2741, r: 120 },
];

/** A timestamp at `h:m` IST, `daysAgo` days before today (IST). */
function ist(daysAgo, h, m = 0) {
  const now = new Date(Date.now() + 5.5 * 3600e3);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, h, m) - 5.5 * 3600e3,
  );
}

// Deterministic, so a re-seed films the same numbers.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const jitter = (lat, lng, metres) => ({
  lat: lat + ((rand() - 0.5) * metres) / 55500,
  lng: lng + ((rand() - 0.5) * metres) / 49700,
});

async function makeUser(p, state) {
  const { data, error } = await admin.auth.admin.createUser({
    email: p.email,
    password: p.password,
    email_confirm: true,
  });
  if (error) throw new Error(`create ${p.code}: ${error.message}`);
  state.users.push(data.user.id);
  const { error: pe } = await admin.from("profiles").upsert({
    id: data.user.id,
    employee_code: p.code,
    role: p.role,
    full_name: p.name,
    email: p.email,
    phone: p.phone ?? null,
    joined_at: ist(400 + Math.floor(rand() * 500), 0).toISOString().slice(0, 10),
  });
  if (pe) throw new Error(`profile ${p.code}: ${pe.message}`);
  return data.user.id;
}

async function seedAll() {
  if (fs.existsSync(STATE_FILE)) throw new Error("Demo data already seeded — run teardown first.");
  const state = { users: [], sites: [], bookings: [], ids: {}, siteIds: {} };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  try {
    for (const [key, p] of Object.entries(PEOPLE)) state.ids[key] = await makeUser(p, state);
    const crew = [];
    for (const [code, name] of CREW) {
      const email = `${name.toLowerCase().replace(" ", ".")}@nbss.co.in`;
      const id = await makeUser({ code, name, role: "guard", email, password: `${code.slice(-3)}${code.slice(-3)}`, phone: `98640 ${30000 + Number(code.slice(-3))}` }, state);
      crew.push({ id, code, name });
    }
    save();

    for (const s of SITES) {
      const { data, error } = await admin
        .from("sites")
        .insert({
          name: s.name,
          client_id: s.client ? state.ids[s.client] : null,
          client_name: s.client ? PEOPLE[s.client].name : "Gwdan Market Traders' Association",
          district: s.district,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          geofence_radius_m: s.r,
          shift_start: "08:00",
          shift_end: "16:00",
          grace_minutes: 10,
        })
        .select("id")
        .single();
      if (error) throw new Error(`site ${s.key}: ${error.message}`);
      state.sites.push(data.id);
      state.siteIds[s.key] = data.id;
    }
    save();

    // A month of attendance. Each guard keeps one post and one of three
    // eight-hour slots; a few days off, a few late arrivals, some overtime.
    const siteList = SITES.map((s) => ({ ...s, id: state.siteIds[s.key] }));
    const everyone = [...crew, { id: state.ids.guard, code: PEOPLE.guard.code, name: PEOPLE.guard.name }];
    const slots = [0, 8, 16];
    const rows = [];
    everyone.forEach((g, i) => {
      const site = siteList[i % siteList.length];
      const slot = slots[i % 3];
      for (let d = 29; d >= 1; d--) {
        if (rand() < 0.09) continue; // day off
        if (d === 1 && slot === 16) continue; // would run into tonight's shift
        const late = rand() < 0.12;
        const inMin = late ? 12 + Math.floor(rand() * 25) : -Math.floor(rand() * 12);
        const start = ist(d, slot, 0);
        const checkIn = new Date(start.getTime() + inMin * 60e3);
        const extra = rand() < 0.18 ? 45 + Math.floor(rand() * 90) : Math.floor(rand() * 15);
        const checkOut = new Date(start.getTime() + (480 + extra) * 60e3);
        const a = jitter(site.lat, site.lng, site.r * 0.8);
        const b = jitter(site.lat, site.lng, site.r * 0.8);
        rows.push({
          guard_id: g.id,
          site_id: site.id,
          check_in_at: checkIn.toISOString(),
          check_in_lat: a.lat,
          check_in_lng: a.lng,
          check_in_accuracy_m: 8 + Math.round(rand() * 20),
          check_in_distance_m: Math.round(rand() * site.r * 0.7),
          check_out_at: checkOut.toISOString(),
          check_out_lat: b.lat,
          check_out_lng: b.lng,
          check_out_accuracy_m: 8 + Math.round(rand() * 20),
          check_out_distance_m: Math.round(rand() * site.r * 0.7),
          check_out_method: "geofence",
          status: late ? "late" : "present",
        });
      }
    });

    // Tonight: six on duty now, one of them late and one the fence could not
    // confirm. Rakesh and two others are off — Rakesh checks in on camera.
    const tonight = [
      [0, 23, 52, "present", 0],
      [1, 23, 58, "present", 1],
      [2, 0, 3, "present", 2],
      [3, 0, 21, "late", 0],
      [4, 23, 55, "present", 1],
      [5, 0, 9, "pending_review", 2],
    ];
    for (const [ci, h, m, status, si] of tonight) {
      const site = siteList[si];
      const a = jitter(site.lat, site.lng, site.r * 0.6);
      rows.push({
        guard_id: crew[ci].id,
        site_id: site.id,
        check_in_at: ist(h >= 12 ? 1 : 0, h, m).toISOString(),
        check_in_lat: a.lat,
        check_in_lng: a.lng,
        check_in_accuracy_m: status === "pending_review" ? 140 : 12,
        check_in_distance_m: status === "pending_review" ? site.r + 34 : Math.round(rand() * 60),
        status,
      });
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from("attendance").insert(rows.slice(i, i + 200));
      if (error) throw new Error(`attendance: ${error.message}`);
    }

    const bookings = [
      {
        reference: "SR-2609-0041",
        client_id: state.ids.clientB,
        contact_name: "Dr. Mamoni Basumatary",
        organisation: PEOPLE.clientB.name,
        email: PEOPLE.clientB.email,
        phone: PEOPLE.clientB.phone,
        service_type: "hospital-security",
        site_type: "Hospital, emergency block",
        district: "Kokrajhar",
        guards_required: 6,
        shift_pattern: "24x7",
        status: "converted",
        quoted_amount_paise: 12600000,
        site_id: state.siteIds.hospital,
        created_at: ist(21, 11).toISOString(),
        handled_by: state.ids.admin,
        handled_at: ist(18, 15).toISOString(),
      },
      {
        reference: "SR-2609-0052",
        client_id: state.ids.clientA,
        contact_name: "Manoj Wary",
        organisation: PEOPLE.clientA.name,
        email: PEOPLE.clientA.email,
        phone: PEOPLE.clientA.phone,
        service_type: "industrial-warehouse-security",
        site_type: "Second warehouse, 2 acres",
        district: "Chirang",
        guards_required: 3,
        shift_pattern: "night",
        status: "reviewing",
        created_at: ist(2, 10, 20).toISOString(),
      },
    ];
    for (const b of bookings) {
      const { data, error } = await admin.from("service_requests").insert({ ...b, source: "web" }).select("id").single();
      if (error) throw new Error(`booking ${b.reference}: ${error.message}`);
      state.bookings.push(data.id);
    }
    await seedSosHistory(state, crew);
    save();
    console.log(`Seeded ${state.users.length} people, ${state.sites.length} sites, ${rows.length} attendance rows, ${bookings.length} bookings.`);
  } catch (e) {
    save();
    throw e;
  }
}

/**
 * A few alerts from the past month, so the SOS log and a site's history have
 * something to show: two resolved, one stood down. Written directly — the
 * functions that raise and answer alerts insist on the caller being on duty.
 */
async function seedSosHistory(state, crew) {
  const history = [
    { guard: crew[0], site: "warehouse", kind: "intruder", days: 19, answer: 3, open: 26, status: "resolved", note: "Two men at the back fence — left when challenged." },
    { guard: crew[1], site: "hospital", kind: "medical", days: 11, answer: 2, open: 41, status: "resolved", note: "Visitor collapsed at the gate; ambulance called." },
    { guard: crew[2], site: "terminal", kind: "other", days: 4, answer: 1, open: 6, status: "false_alarm", note: "Pressed by mistake." },
  ];
  for (const h of history) {
    const s = SITES.find((x) => x.key === h.site);
    const raised = ist(h.days, 1, 40);
    const { error } = await admin.from("sos_alerts").insert({
      site_id: state.siteIds[h.site],
      raised_by: h.guard.id,
      kind: h.kind,
      lat: s.lat + 0.0003,
      lng: s.lng - 0.0002,
      accuracy_m: 14,
      inside_fence: true,
      status: h.status,
      raised_at: raised.toISOString(),
      acknowledged_at: new Date(raised.getTime() + h.answer * 60e3).toISOString(),
      first_responder: state.ids.supervisor,
      closed_at: new Date(raised.getTime() + h.open * 60e3).toISOString(),
      closed_by: state.ids.supervisor,
      closing_note: h.note,
    });
    if (error) throw new Error(`sos: ${error.message}`);
  }
}

async function teardownAll() {
  if (!fs.existsSync(STATE_FILE)) {
    console.log("Nothing to tear down.");
    return;
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  // Anything the film itself made: the client who registered on camera, the
  // site registered on camera and the booking that client sent.
  // The client who registered on camera, found by address as well as by the id
  // the capture recorded — a capture that stopped half way may not have saved it.
  const { data: filmClients } = await admin.from("profiles").select("id").in("email", ["rahul@gwdanricemill.in"]);
  const extraUsers = [...new Set([...(state.filmUsers ?? []), ...(filmClients ?? []).map((p) => p.id)])];
  const { data: filmSites } = await admin.from("sites").select("id").in("client_id", [...state.users, ...extraUsers]);
  const { data: filmSites2 } = await admin.from("sites").select("id").like("name", "%[demo]%");
  const siteIds = new Set([...state.sites, ...(filmSites ?? []).map((s) => s.id), ...(filmSites2 ?? []).map((s) => s.id), ...(state.filmSites ?? [])]);
  const people = [...state.users, ...extraUsers];

  if (people.length) {
    await admin.from("service_requests").delete().in("client_id", people);
    await admin.from("service_requests").delete().in("handled_by", people);
  }
  if (state.bookings.length) await admin.from("service_requests").delete().in("id", state.bookings);
  for (const id of siteIds) await admin.from("sites").delete().eq("id", id);
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) console.warn(`  could not delete ${id}: ${error.message}`);
  }
  fs.rmSync(STATE_FILE);
  console.log(`Removed ${people.length} people, ${siteIds.size} sites and their attendance and bookings.`);
}

const cmd = process.argv[2];
if (cmd === "seed") await seedAll();
else if (cmd === "teardown") await teardownAll();
else if (cmd) {
  console.error("Usage: node scripts/demo-data.mjs seed|teardown");
  process.exit(1);
}
