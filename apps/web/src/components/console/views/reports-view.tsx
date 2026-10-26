import { CalendarCheck, Clock, TriangleAlert, UserRoundX } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { ReportsWorkspace, type GuardReport, type SiteReport } from "@/components/console/reports-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRole } from "@/lib/auth";
import { istDate, istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";


function defaults(): { from: string; to: string } {
  const today = istDate(new Date());
  return { from: `${today.slice(0, 8)}01`, to: today };
}

const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Attendance for payroll and billing: days, hours, lateness and exceptions per guard and per site. */
/** `siteId`: one site's workspace reports on that site alone. */
export async function ReportsView({ searchParams, siteId }: { searchParams: Promise<{ from?: string; to?: string }>; siteId?: string }) {
  await requireRole("admin", "supervisor");
  const q = await searchParams;
  const d = defaults();
  const from = isDate(q.from) ? q.from! : d.from;
  const to = isDate(q.to) ? q.to! : d.to;
  const start = istInstant(from, "00:00").toISOString();
  const end = new Date(istInstant(to, "00:00").getTime() + 86_400_000).toISOString();

  const supabase = await supabaseServer();
  const [guards, sites, att, shifts, sos] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_code").eq("role", "guard").order("full_name"),
    supabase.from("sites").select("id, name, district, guards_required").match(siteId ? { id: siteId } : {}).order("name"),
    supabase
      .from("attendance")
      .select("guard_id, site_id, check_in_at, worked_minutes, overtime_minutes, status, device_flag, off_roster")
      .gte("check_in_at", start)
      .lt("check_in_at", end)
      .match(siteId ? { site_id: siteId } : {})
      .limit(20000),
    supabase.from("shifts").select("guard_id, site_id, status, replaces_shift, replaced_by_shift").gte("starts_at", start).lt("starts_at", end).match(siteId ? { site_id: siteId } : {}).limit(20000),
    supabase.from("sos_alerts").select("site_id").gte("raised_at", start).lt("raised_at", end).match(siteId ? { site_id: siteId } : {}),
  ]);

  const A = att.data ?? [];
  const S = shifts.data ?? [];
  const dayOf = (iso: string | null) => (iso ? istDate(new Date(iso)) : "");

  const guardRows: GuardReport[] = (guards.data ?? [])
    .map((g) => {
      const mine = A.filter((a) => a.guard_id === g.id && a.status !== "rejected");
      const sh = S.filter((s) => s.guard_id === g.id);
      return {
        id: g.id,
        name: g.full_name,
        code: g.employee_code,
        days: new Set(mine.map((a) => dayOf(a.check_in_at))).size,
        shifts: mine.length,
        workedMinutes: mine.reduce((n, a) => n + (a.worked_minutes ?? 0), 0),
        overtimeMinutes: mine.reduce((n, a) => n + (a.overtime_minutes ?? 0), 0),
        // Late days, not late punches, as days present are counted.
        late: new Set(mine.filter((a) => a.status === "late").map((a) => dayOf(a.check_in_at))).size,
        missed: sh.filter((s) => s.status === "missed").length,
        replaced: sh.filter((s) => s.replaced_by_shift).length,
        covered: sh.filter((s) => s.replaces_shift).length,
        flagged: mine.filter((a) => a.device_flag).length,
        offRoster: mine.filter((a) => a.off_roster).length,
      };
    })
    .filter((r) => r.shifts > 0 || r.missed > 0 || r.replaced > 0);

  const siteRows: SiteReport[] = (sites.data ?? []).map((s) => {
    const here = A.filter((a) => a.site_id === s.id && a.status !== "rejected");
    return {
      id: s.id,
      name: s.name,
      district: s.district,
      required: s.guards_required,
      daysStaffed: new Set(here.map((a) => dayOf(a.check_in_at))).size,
      guards: new Set(here.map((a) => a.guard_id)).size,
      workedMinutes: here.reduce((n, a) => n + (a.worked_minutes ?? 0), 0),
      missed: S.filter((x) => x.site_id === s.id && x.status === "missed").length,
      sos: (sos.data ?? []).filter((x) => x.site_id === s.id).length,
    };
  });

  const total = guardRows.reduce((n, r) => n + r.workedMinutes, 0);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Attendance" title="Reports" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Guard-hours" value={(total / 60).toFixed(0)} hint={`${from} to ${to}`} icon={Clock} tone="emerald" />
        <StatCard label="Shifts worked" value={String(guardRows.reduce((n, r) => n + r.shifts, 0))} hint={`${guardRows.length} guards`} icon={CalendarCheck} tone="sky" />
        <StatCard label="Missed shifts" value={String(guardRows.reduce((n, r) => n + r.missed, 0))} hint="Rostered, nobody came" icon={UserRoundX} tone="rose" />
        <StatCard label="Flagged check-ins" value={String(guardRows.reduce((n, r) => n + r.flagged + r.offRoster, 0))} hint="Other phone or off the roster" icon={TriangleAlert} tone="amber" />
      </div>
      <ReportsWorkspace from={from} to={to} guards={guardRows} sites={siteRows} />
    </div>
  );
}
