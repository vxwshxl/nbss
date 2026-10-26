import "server-only";

import { istDate, istInstant } from "@/lib/roster";
import type { supabaseServer } from "@/lib/supabase/server";

/**
 * Attendance as a register: every rostered duty in a period with what happened to it,
 * plus check-ins that were not on the roster. The same rules as one guard's register
 * (/console/reports/guard/[id]): a duty that ended with no check-in is absent; one handed
 * to another guard is replaced (not held against this guard); a duty worked in several
 * sessions is one duty, its hours summed.
 */
export type Outcome = "present" | "late" | "absent" | "replaced" | "on_duty" | "upcoming" | "not_arrived" | "review" | "off_roster";

export type RegisterEntry = {
  key: string;
  guardId: string;
  guardName: string;
  guardCode: string;
  siteId: string;
  siteName: string;
  day: string;
  startsAt: string;
  endsAt: string | null;
  outcome: Outcome;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number;
  sessions: number;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
type Named = { full_name: string; employee_code: string } | null;

export async function registerBetween(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  from: string,
  to: string,
  opts: { siteId?: string; now: number },
): Promise<RegisterEntry[]> {
  const start = istInstant(from, "00:00").toISOString();
  const end = new Date(istInstant(to, "00:00").getTime() + 86_400_000).toISOString();
  let sq = supabase
    .from("shifts")
    .select("id, guard_id, site_id, starts_at, ends_at, status, replaced_by_shift, profiles!shifts_guard_id_fkey(full_name, employee_code), sites(name)")
    .gte("starts_at", start)
    .lt("starts_at", end)
    .or("status.neq.cancelled,replaced_by_shift.not.is.null")
    .limit(20000);
  let aq = supabase
    .from("attendance")
    .select("id, guard_id, site_id, shift_id, check_in_at, check_out_at, worked_minutes, status, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name)")
    .gte("check_in_at", start)
    .lt("check_in_at", end)
    .order("check_in_at")
    .limit(20000);
  if (opts.siteId) {
    sq = sq.eq("site_id", opts.siteId);
    aq = aq.eq("site_id", opts.siteId);
  }
  const [shifts, att] = await Promise.all([sq, aq]);

  const byShift = new Map<string, NonNullable<typeof att.data>>();
  for (const a of att.data ?? []) if (a.shift_id) byShift.set(a.shift_id, [...(byShift.get(a.shift_id) ?? []), a]);
  const used = new Set<string>();
  const out: RegisterEntry[] = [];

  for (const s of shifts.data ?? []) {
    if (!s.guard_id) continue;
    const sessions = byShift.get(s.id) ?? [];
    for (const x of sessions) used.add(x.id);
    const first = sessions[0];
    const open = sessions.some((x) => !x.check_out_at);
    let outcome: Outcome;
    if (s.replaced_by_shift && !first) outcome = "replaced";
    else if (first) outcome = open ? "on_duty" : first.status === "late" ? "late" : first.status === "pending_review" || first.status === "rejected" ? "review" : "present";
    else if (new Date(s.ends_at).getTime() < opts.now) outcome = "absent";
    else if (new Date(s.starts_at).getTime() <= opts.now) outcome = "not_arrived";
    else outcome = "upcoming";
    const p = one(s.profiles as unknown as Named);
    out.push({
      key: s.id,
      guardId: s.guard_id,
      guardName: p?.full_name ?? "A guard",
      guardCode: p?.employee_code ?? "",
      siteId: s.site_id,
      siteName: one(s.sites as unknown as { name: string } | null)?.name ?? "A site",
      day: istDate(new Date(s.starts_at)),
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      outcome,
      checkIn: first?.check_in_at ?? null,
      checkOut: first && !open ? (sessions.at(-1)!.check_out_at ?? null) : null,
      workedMinutes: sessions.reduce((n, x) => n + (x.worked_minutes ?? 0), 0),
      sessions: sessions.length,
    });
  }
  for (const a of att.data ?? []) {
    if (used.has(a.id) || !a.check_in_at) continue;
    const p = one(a.profiles as unknown as Named);
    out.push({
      key: a.id,
      guardId: a.guard_id,
      guardName: p?.full_name ?? "A guard",
      guardCode: p?.employee_code ?? "",
      siteId: a.site_id,
      siteName: one(a.sites as unknown as { name: string } | null)?.name ?? "A site",
      day: istDate(new Date(a.check_in_at)),
      startsAt: a.check_in_at,
      endsAt: a.check_out_at,
      outcome: !a.check_out_at ? "on_duty" : "off_roster",
      checkIn: a.check_in_at,
      checkOut: a.check_out_at,
      workedMinutes: a.worked_minutes ?? 0,
      sessions: 1,
    });
  }
  return out;
}

/** Outcomes that mean the guard came that day. */
export const CAME: readonly Outcome[] = ["present", "late", "on_duty", "review", "off_roster"];

/**
 * The register's counts for a set of entries, by guard-day, not by row.
 *
 * Two check-ins on one day (out and back, a second punch at the same site, an off-roster
 * punch beside the rostered one) are all listed, but they are one day present: counting
 * rows let a guard double a day by checking in twice. A day is absent only when the
 * guard did not come at all; the rate is days attended of days rostered. Hours are the
 * sum of everything worked.
 */
export function tallyRegister(rows: RegisterEntry[]) {
  const key = (r: RegisterEntry) => `${r.guardId}|${r.day}`;
  const came = new Set(rows.filter((r) => CAME.includes(r.outcome)).map(key));
  const late = new Set(rows.filter((r) => r.outcome === "late").map(key)).size;
  const absent = new Set(rows.filter((r) => r.outcome === "absent" && !came.has(key(r))).map(key)).size;
  const dueDays = [...new Set(rows.filter((r) => r.outcome !== "upcoming" && r.outcome !== "replaced" && r.outcome !== "off_roster").map(key))];
  const minutes = rows.reduce((n, r) => n + r.workedMinutes, 0);
  const rate = dueDays.length ? Math.round((dueDays.filter((k) => came.has(k)).length / dueDays.length) * 100) : null;
  return { present: came.size, late, absent, minutes, rate, due: dueDays.length };
}
