// Checks 0082 (supervisors and field officers check in): applies it inside a transaction,
// runs it as the TEST accounts, then ROLLS BACK. Nothing persists. Run: node scripts/check-field-staff-check-in.mjs
import fs from "node:fs";
import { connect } from "./db.mjs";
const c = await connect();
const SITE = "070e33c8-cbd5-417d-a3c4-61669538108d"; // Load site 01 (test)
const SITE2 = "efccfa80-255d-42bb-9058-35711625de5e"; // Load site 02 (test)
const ok = [], bad = [];
const check = (name, cond, extra = "") => (cond ? ok : bad).push(`${cond ? "✓" : "✗"} ${name} ${extra}`);
// now() is frozen inside one transaction: move a fresh check-in an hour back so fixes and check-out come after it.
async function backdate(uid) {
  await c.query("update attendance set check_in_at = now() - interval '1 hour' where guard_id = $1 and check_out_at is null", [uid]);
  await c.query("update guard_location_history set recorded_at = now() - interval '1 hour' where guard_id = $1 and ping_reason = 'check_in' and recorded_at = now()", [uid]);
}
async function as(uid, sql, params = []) {
  await c.query("savepoint s");
  try {
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [JSON.stringify({ sub: uid, role: "authenticated" }), uid]);
    await c.query("set local role authenticated");
    const r = await c.query(sql, params);
    await c.query("reset role");
    await c.query("release savepoint s");
    return { rows: r.rows };
  } catch (e) {
    await c.query("rollback to savepoint s");
    return { error: e.message };
  }
}
try {
  await c.query("begin");
  await c.query(fs.readFileSync("supabase/migrations/0082_field_staff_check_in.sql", "utf8"));
  const sup = (await c.query("select id from profiles where employee_code='TEST-SUP'")).rows[0].id;
  const g2 = (await c.query("select id from profiles where employee_code='TEST-G2'")).rows[0].id;
  await c.query("insert into site_postings (guard_id, site_id, active, starts, ends) values ($1, $2, true, '00:00', '23:59')", [sup, SITE]);

  // Supervisor: own site, inside
  let r = await as(sup, "select punch_in($1, 26.4015, 90.2797, 10) j", [SITE]);
  check("supervisor checks in at own site", r.rows?.[0]?.j?.ok, JSON.stringify(r.error ?? r.rows[0].j));
  check("supervisor not flagged off-roster", r.rows?.[0]?.j?.off_roster === false);
  await backdate(sup);
  r = await as(sup, "select record_positions($1::jsonb) j", [JSON.stringify([{ lat: 26.4016, lng: 90.2797, accuracy_m: 8, at: Date.now() }])]);
  check("supervisor tracked", r.rows?.[0]?.j?.tracked === true && r.rows[0].j.stored === 1, JSON.stringify(r.error ?? r.rows[0].j));
  r = await as(sup, "select punch_out(26.4015, 90.2797, 10) j");
  check("supervisor checks out at site", r.rows?.[0]?.j?.ok, JSON.stringify(r.error ?? r.rows[0].j));
  // Supervisor: someone else's site
  r = await as(sup, "select punch_in($1, 26.41048, 90.28907, 10) j", [SITE2]);
  check("supervisor refused at a site not theirs", !!r.error && /only at a site you supervise/.test(r.error), r.error);
  // Supervisor: own site but outside the fence
  r = await as(sup, "select punch_in($1, 26.45, 90.35, 10) j", [SITE]);
  check("supervisor refused outside boundary", !!r.error && /outside/.test(r.error), r.error);

  // Field officer (TEST-G2 made one inside this transaction)
  await c.query("update profiles set role='field_officer' where id=$1", [g2]);
  r = await as(g2, "select punch_in(null, 26.5, 90.1, 20) j");
  check("field officer checks in anywhere, no site", r.rows?.[0]?.j?.ok && r.rows[0].j.site_id === null, JSON.stringify(r.error ?? r.rows[0].j));
  await backdate(g2);
  r = await as(g2, "select record_positions($1::jsonb) j", [JSON.stringify([{ lat: 26.51, lng: 90.11, accuracy_m: 9, at: Date.now() }])]);
  check("field officer tracked (no fence)", r.rows?.[0]?.j?.tracked === true && r.rows[0].j.stored === 1, JSON.stringify(r.error ?? r.rows[0].j));
  r = await as(g2, "select record_position(26.52, 90.12, 9) j");
  check("record_position works too", r.rows?.[0]?.j?.tracked === true, JSON.stringify(r.error ?? r.rows[0].j));
  r = await as(g2, "select count(*)::int n from attendance where guard_id = auth.uid() and site_id is null");
  check("field officer reads own field check-in (test view)", r.rows?.[0]?.n === 1, JSON.stringify(r.error ?? r.rows[0]));
  const pos = (await c.query("select site_id, inside_fence from guard_positions where guard_id=$1", [g2])).rows[0];
  check("live position stored with no site", pos && pos.site_id === null && pos.inside_fence === null, JSON.stringify(pos));
  r = await as(g2, "select punch_in(null, 26.5, 90.1, 20) j");
  check("double check-in refused", !!r.error && /already checked in/.test(r.error), r.error);
  r = await as(g2, "select punch_in(null, 26.5, 90.1, 400) j");
  check("poor accuracy refused", !!r.error, r.error);
  r = await as(g2, "select punch_out(26.7, 90.4, 15) j");
  check("field officer checks out anywhere", r.rows?.[0]?.j?.ok, JSON.stringify(r.error ?? r.rows[0].j));
  const done = (await c.query("select worked_minutes, check_out_lat from attendance where guard_id=$1 order by check_in_at desc limit 1", [g2])).rows[0];
  check("check-out recorded, 60 min worked", done.check_out_lat === 26.7 && done.worked_minutes === 60, JSON.stringify(done));

  // Auto check-out of a forgotten field duty after 12 h
  await c.query("insert into attendance (guard_id, site_id, check_in_at, check_in_lat, check_in_lng) values ($1, null, now() - interval '13 hours', 26.5, 90.1)", [g2]);
  const n = (await c.query("select auto_check_out() n")).rows[0].n;
  const auto = (await c.query("select check_out_method, check_out_at - check_in_at d from attendance where guard_id=$1 and check_in_at < now() - interval '12 hours' order by check_in_at desc limit 1", [g2])).rows[0];
  check("forgotten field duty auto-closed at 12 h", n >= 1 && auto.check_out_method === "auto_close", JSON.stringify({ n, auto }));

  // Guard path unchanged
  const g1 = (await c.query("select id from profiles where employee_code='TEST-G1'")).rows[0].id;
  r = await as(g1, "select punch_in($1, 26.45, 90.35, 10) j", [SITE]);
  check("guard still refused outside boundary", !!r.error && /outside/.test(r.error), r.error);
  // Client still cannot
  const cl = (await c.query("select id from profiles where role='client' and is_test limit 1")).rows[0]?.id;
  if (cl) { r = await as(cl, "select punch_in($1, 26.4015, 90.2797, 10) j", [SITE]); check("client refused", !!r.error, r.error); }
} catch (e) {
  bad.push("✗ crashed: " + e.message);
} finally {
  await c.query("rollback");
  await c.end();
}
console.log([...ok, ...bad].join("\n"));
console.log(`\n${ok.length} passed, ${bad.length} failed. Rolled back.`);
