"use server";

import { requireRoleSession, type Role } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { site as company } from "@/content/site";

/**
 * Everything the person popup shows, loaded when it opens rather than with the
 * table — a roster of two hundred never pays for profiles nobody clicks.
 *
 * Read on the signed-in person's own client, so RLS still decides: a
 * supervisor sees what a supervisor may see and nothing else.
 */
export type DayMark = { date: string; state: "present" | "late" | "absent" | "review" | "none" };

export type PersonPreview = {
  id: string;
  name: string;
  code: string;
  role: Role;
  email: string | null;
  phone: string | null;
  active: boolean;
  joined: string | null;
  lastSeen: string | null;
  mustChangePin: boolean;
  guard?: {
    onDuty: { site: string; since: string } | null;
    days30: number;
    late30: number;
    hours30: number;
    lastPunch: string | null;
    strip: DayMark[];
  };
  client?: {
    sites: { name: string; district: string | null; active: boolean }[];
  };
};

function istDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: company.timeZone });
}

export async function personPreview(id: string): Promise<PersonPreview | { error: string }> {
  await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data: p } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, role, email, phone, active, joined_at, created_at, last_seen_at, must_change_pin")
    .eq("id", id)
    .maybeSingle();

  if (!p) return { error: "That person could not be found." };

  const base: PersonPreview = {
    id: p.id,
    name: p.full_name,
    code: p.employee_code,
    role: p.role,
    email: p.email,
    phone: p.phone,
    active: p.active,
    joined: p.joined_at ?? p.created_at,
    lastSeen: p.last_seen_at,
    mustChangePin: p.must_change_pin,
  };

  if (p.role === "guard") {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const { data: rows } = await supabase
      .from("attendance")
      .select("check_in_at, check_out_at, worked_minutes, status, sites(name)")
      .eq("guard_id", id)
      .gte("check_in_at", since.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(200);

    const list = rows ?? [];
    const open = list.find((r) => r.check_in_at && !r.check_out_at);
    const worked = list.filter((r) => r.status === "present" || r.status === "late");

    const byDay = new Map<string, DayMark["state"]>();
    for (const r of list) {
      if (!r.check_in_at) continue;
      const day = istDate(new Date(r.check_in_at));
      const state: DayMark["state"] =
        r.status === "present" ? "present" : r.status === "late" ? "late" : r.status === "absent" || r.status === "rejected" ? "absent" : "review";
      // A good punch outranks a bad one on the same day.
      if (!byDay.has(day) || state === "present") byDay.set(day, state);
    }
    const strip: DayMark[] = Array.from({ length: 14 }, (_, i) => {
      const d = istDate(new Date(Date.now() - (13 - i) * 86_400_000));
      return { date: d, state: byDay.get(d) ?? "none" };
    });

    base.guard = {
      onDuty: open
        ? { site: (open.sites as unknown as { name: string } | null)?.name ?? "A site", since: open.check_in_at! }
        : null,
      days30: new Set(worked.map((r) => istDate(new Date(r.check_in_at!)))).size,
      late30: list.filter((r) => r.status === "late").length,
      hours30: Math.round(worked.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0) / 60),
      lastPunch: list[0]?.check_in_at ?? null,
      strip,
    };
  }

  if (p.role === "client") {
    const { data: sites } = await supabase
      .from("sites")
      .select("name, district, active")
      .eq("client_id", id)
      .order("name");
    base.client = { sites: sites ?? [] };
  }

  return base;
}
