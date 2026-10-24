import { ArrowLeftRight, CalendarClock, UserRoundX, Users } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import {
  ReplacementsWorkspace,
  type Duty,
  type GuardOption,
  type ReplacementRequest,
  type ReplacementRow,
} from "@/components/console/replacements-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";


const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
type Named = { full_name: string } | null;

function window(): { from: string; to: string; back: string } {
  const now = Date.now();
  return {
    from: new Date(now).toISOString(),
    to: new Date(now + 14 * 86_400_000).toISOString(),
    back: new Date(now - 30 * 86_400_000).toISOString(),
  };
}

/** The request's clock, read once. */
function nowMs(): number {
  return Date.now();
}

/** Who covers when a guard cannot. */
/** `siteId`: one site's workspace shows only that site's duties and covers. */
export async function ReplacementsView({ siteId }: { siteId?: string } = {}) {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();
  const w = window();

  const [guards, upcoming, requests, made] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code, phone").eq("role", "guard").eq("active", true).order("full_name"),
    supabase
      .from("shifts")
      .select("id, guard_id, site_id, starts_at, ends_at, status, shift_type, profiles!shifts_guard_id_fkey(full_name), sites(name)")
      .in("status", ["scheduled", "in_progress", "missed"])
      .is("replaced_by_shift", null)
      .gt("ends_at", w.from)
      .lt("starts_at", w.to)
      .match(siteId ? { site_id: siteId } : {})
      .order("starts_at"),
    supabase
      .from("replacement_requests")
      .select("id, reason, created_at, shift_id, profiles!replacement_requests_guard_id_fkey(full_name, phone)")
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, starts_at, ends_at, status, shift_type, replaces_shift, guard:profiles!shifts_guard_id_fkey(full_name), sites(name)")
      .not("replaces_shift", "is", null)
      .gt("ends_at", w.back)
      .match(siteId ? { site_id: siteId } : {})
      .order("starts_at", { ascending: false })
      .limit(300),
  ]);

  const duties: Duty[] = (upcoming.data ?? []).map((s) => ({
    id: s.id,
    guardId: s.guard_id,
    guardName: one(s.profiles as unknown as Named)?.full_name ?? "A guard",
    siteId: s.site_id,
    siteName: one(s.sites as unknown as { name: string } | null)?.name ?? "A site",
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    status: s.status,
    shiftType: s.shift_type,
  }));

  // The duty each request is about, which may not be in the upcoming list (already started).
  const reqShiftIds = (requests.data ?? []).map((r) => r.shift_id);
  const reqShifts = reqShiftIds.length
    ? ((
        await supabase
          .from("shifts")
          .select("id, guard_id, site_id, starts_at, ends_at, status, shift_type, profiles!shifts_guard_id_fkey(full_name), sites(name)")
          .in("id", reqShiftIds)
      ).data ?? [])
    : [];
  const reqs: ReplacementRequest[] = (requests.data ?? []).flatMap((r) => {
    const s = reqShifts.find((x) => x.id === r.shift_id);
    if (!s || (siteId && s.site_id !== siteId)) return [];
    const p = one(r.profiles as unknown as { full_name: string; phone: string | null } | null);
    return [
      {
        id: r.id,
        guardName: p?.full_name ?? "A guard",
        guardPhone: p?.phone ?? null,
        reason: r.reason,
        createdAt: r.created_at,
        duty: {
          id: s.id,
          guardId: s.guard_id,
          guardName: p?.full_name ?? "A guard",
          siteId: s.site_id,
          siteName: one(s.sites as unknown as { name: string } | null)?.name ?? "A site",
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          status: s.status,
          shiftType: s.shift_type,
        },
      },
    ];
  });

  // Who each replacement replaced.
  const originals = (made.data ?? []).map((s) => s.replaces_shift).filter(Boolean) as string[];
  const origRows = originals.length
    ? ((await supabase.from("shifts").select("id, cancel_reason, profiles!shifts_guard_id_fkey(full_name)").in("id", originals)).data ?? [])
    : [];
  const now = nowMs();
  const history: ReplacementRow[] = (made.data ?? []).map((s) => {
    const o = origRows.find((x) => x.id === s.replaces_shift);
    return {
      id: s.id,
      siteName: one(s.sites as unknown as { name: string } | null)?.name ?? "A site",
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      shiftType: s.shift_type,
      fromGuard: one(o?.profiles as unknown as Named)?.full_name ?? "A guard",
      toGuard: one(s.guard as unknown as Named)?.full_name ?? "A guard",
      reason: o?.cancel_reason && o.cancel_reason !== "Replaced" ? o.cancel_reason : null,
      status: s.status === "scheduled" && new Date(s.starts_at).getTime() > now ? "scheduled" : s.status,
    };
  });

  const options: GuardOption[] = (guards.data ?? []).map((g) => ({ id: g.id, name: g.full_name, code: g.employee_code, phone: g.phone }));
  const busy = new Set(duties.filter((d) => new Date(d.startsAt).getTime() <= now + 86_400_000).map((d) => d.guardId));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Shift management" title="Replacements" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Asked for cover" value={String(reqs.length)} hint={reqs.length ? "Waiting for you" : "No requests"} icon={UserRoundX} tone={reqs.length ? "amber" : "slate"} />
        <StatCard
          label="Replacements, 30 days"
          value={String(history.filter((h) => new Date(h.startsAt).getTime() <= now).length)}
          hint="Duties covered by someone else"
          icon={ArrowLeftRight}
          tone="sky"
        />
        <StatCard label="Upcoming duties" value={String(duties.length)} hint="Next 14 days" icon={CalendarClock} tone="violet" />
        <StatCard label="Free in the next 24 h" value={String(options.filter((g) => !busy.has(g.id)).length)} hint="Guards with no duty" icon={Users} tone="emerald" />
      </div>
      <ReplacementsWorkspace requests={reqs} duties={duties} guards={options} history={history} />
    </div>
  );
}
