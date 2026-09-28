"use server";

import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

/**
 * Everything about one site the desk might need in a hurry — who is standing
 * there now and how to reach them, who usually is, whose site it is and their
 * number, every SOS raised there, and the booking it came from. Loaded when
 * the popup opens, on the viewer's own session so RLS still applies.
 */
export type SitePerson = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
};

export type SiteDetail = {
  onDuty: (SitePerson & { attendanceId: string; since: string; late: boolean; distance: number | null })[];
  regulars: (SitePerson & { shifts: number; last: string })[];
  client: (SitePerson & { email: string | null }) | null;
  stats: { shifts30: number; guards30: number; late30: number; hours30: number };
  sos: { id: string; status: Enums["sos_status"]; kind: Enums["sos_kind"]; raisedAt: string; by: string }[];
  bookings: { id: string; reference: string; status: string; quoted: number | null }[];
  /** The roster: how many the site needs, and who is posted here. */
  required: number | null;
  posted: (SitePerson & { starts: string; ends: string; days: number[] })[];
};

type Person = { id: string; full_name: string; employee_code: string; phone: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function siteDetail(siteId: string): Promise<SiteDetail | { error: string }> {
  await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: site }, { data: live }, { data: month }, { data: sos }, { data: bookings }, { data: postings }] = await Promise.all([
    supabase.from("sites").select("id, client_id, guards_required").eq("id", siteId).maybeSingle(),
    supabase
      .from("attendance")
      .select("id, check_in_at, status, check_in_distance_m, profiles!attendance_guard_id_fkey(id, full_name, employee_code, phone)")
      .eq("site_id", siteId)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("guard_id, check_in_at, status, worked_minutes, profiles!attendance_guard_id_fkey(id, full_name, employee_code, phone)")
      .eq("site_id", siteId)
      .gte("check_in_at", since)
      .order("check_in_at", { ascending: false })
      .limit(2000),
    supabase
      .from("sos_alerts")
      .select("id, status, kind, raised_at, guard:profiles!sos_alerts_raised_by_fkey(full_name)")
      .eq("site_id", siteId)
      .order("raised_at", { ascending: false })
      .limit(10),
    supabase
      .from("service_requests")
      .select("id, reference, status, quoted_amount_paise")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("site_postings")
      .select("guard_id, starts, ends, days, profiles!site_postings_guard_id_fkey(id, full_name, employee_code, phone)")
      .eq("site_id", siteId)
      .eq("active", true),
  ]);

  if (!site) return { error: "That site could not be found." };

  let client: SiteDetail["client"] = null;
  if (site.client_id) {
    const { data: c } = await supabase
      .from("profiles")
      .select("id, full_name, employee_code, phone, email")
      .eq("id", site.client_id)
      .maybeSingle();
    if (c) client = { id: c.id, name: c.full_name, code: c.employee_code, phone: c.phone, email: c.email };
  }

  const rows = month ?? [];
  const byGuard = new Map<string, { p: Person; shifts: number; last: string }>();
  for (const r of rows) {
    const p = one(r.profiles as unknown as Person | null);
    if (!p || !r.check_in_at) continue;
    const g = byGuard.get(p.id);
    if (g) g.shifts += 1;
    else byGuard.set(p.id, { p, shifts: 1, last: r.check_in_at });
  }
  const worked = rows.filter((r) => r.status === "present" || r.status === "late");

  return {
    onDuty: (live ?? []).flatMap((r) => {
      const p = one(r.profiles as unknown as Person | null);
      return p && r.check_in_at
        ? [
            {
              id: p.id,
              name: p.full_name,
              code: p.employee_code,
              phone: p.phone,
              attendanceId: r.id,
              since: r.check_in_at,
              late: r.status === "late",
              distance: r.check_in_distance_m,
            },
          ]
        : [];
    }),
    regulars: [...byGuard.values()]
      .sort((a, b) => b.shifts - a.shifts)
      .slice(0, 8)
      .map(({ p, shifts, last }) => ({ id: p.id, name: p.full_name, code: p.employee_code, phone: p.phone, shifts, last })),
    client,
    stats: {
      shifts30: rows.length,
      guards30: byGuard.size,
      late30: rows.filter((r) => r.status === "late").length,
      hours30: Math.round(worked.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0) / 60),
    },
    sos: (sos ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      kind: a.kind,
      raisedAt: a.raised_at,
      by: one(a.guard as unknown as { full_name: string } | null)?.full_name ?? "A guard",
    })),
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      quoted: b.quoted_amount_paise,
    })),
    required: site.guards_required,
    posted: (postings ?? []).flatMap((p) => {
      const g = one(p.profiles as unknown as Person | null);
      return g
        ? [{ id: g.id, name: g.full_name, code: g.employee_code, phone: g.phone, starts: p.starts, ends: p.ends, days: p.days }]
        : [];
    }),
  };
}
