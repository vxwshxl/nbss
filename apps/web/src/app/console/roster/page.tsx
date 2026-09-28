import type { Metadata } from "next";
import { CalendarRange, ShieldQuestion, UserRoundX, Users } from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import {
  RosterWorkspace,
  type RosterGuard,
  type RosterShift,
  type RosterSite,
} from "@/components/console/roster-workspace";
import { StatCard } from "@/components/console/stat-card";
import { requireRoleSession } from "@/lib/auth";
import { istDay, istDate, istInstant } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Roster" };
export const dynamic = "force-dynamic";

type Person = { full_name: string; employee_code: string; phone: string | null };
/** The request's clock, read once. */
function nowMs(): number {
  return Date.now();
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * Who guards where. Each guard has one standing post; the week's shifts are
 * written from it, and cover shifts are added by hand. The page answers the
 * three questions a supervisor asks every evening: is every site staffed, who
 * has not turned up, and who checked in somewhere they were not sent.
 */
export default async function RosterPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const from = istInstant(istDay(-1), "00:00");
  const to = istInstant(istDay(7), "00:00");

  const [sites, postings, guards, shifts, open, offRoster] = await Promise.all([
    supabase.from("sites").select("id, name, client_name, district, guards_required, grace_minutes").eq("active", true).order("name"),
    supabase
      .from("site_postings")
      .select("id, site_id, guard_id, starts, ends, days, profiles!site_postings_guard_id_fkey(full_name, employee_code, phone)")
      .eq("active", true),
    supabase.from("profiles").select("id, full_name, employee_code, phone").eq("role", "guard").eq("active", true).order("full_name"),
    supabase
      .from("shifts")
      .select("id, site_id, guard_id, starts_at, ends_at, status, notes, posting_id")
      .neq("status", "cancelled")
      .gte("ends_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase.from("attendance").select("id, guard_id, site_id").is("check_out_at", null),
    supabase
      .from("attendance")
      .select("id, guard_id, site_id, check_in_at, profiles!attendance_guard_id_fkey(full_name, employee_code, phone), sites(name)")
      .eq("off_roster", true)
      .eq("status", "pending_review")
      .order("check_in_at", { ascending: false })
      .limit(50),
  ]);

  const guardById = new Map((guards.data ?? []).map((g) => [g.id, g]));
  const onDutyAt = new Map<string, string>(); // guard → site they are checked in at
  for (const a of open.data ?? []) onDutyAt.set(a.guard_id, a.site_id);

  const now = nowMs();
  const graceBySite = new Map((sites.data ?? []).map((s) => [s.id, s.grace_minutes]));

  const allShifts: RosterShift[] = (shifts.data ?? []).map((s) => {
    const g = guardById.get(s.guard_id);
    const started = new Date(s.starts_at).getTime() + (graceBySite.get(s.site_id) ?? 10) * 60_000 < now;
    const running = new Date(s.ends_at).getTime() > now;
    return {
      id: s.id,
      siteId: s.site_id,
      guardId: s.guard_id,
      guardName: g?.full_name ?? "A guard",
      guardCode: g?.employee_code ?? "",
      guardPhone: g?.phone ?? null,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      date: istDate(new Date(s.starts_at)),
      status: s.status,
      cover: !s.posting_id,
      notArrived: s.status === "scheduled" && started && running && onDutyAt.get(s.guard_id) !== s.site_id,
      upcoming: s.status === "scheduled" && new Date(s.starts_at).getTime() > now,
    };
  });

  const days = Array.from({ length: 7 }, (_, i) => istDay(i));

  const rows: RosterSite[] = (sites.data ?? []).map((s) => {
    const posted = (postings.data ?? [])
      .filter((p) => p.site_id === s.id)
      .map((p) => {
        const g = one(p.profiles as unknown as Person | null);
        return {
          postingId: p.id,
          guardId: p.guard_id,
          name: g?.full_name ?? "A guard",
          code: g?.employee_code ?? "",
          phone: g?.phone ?? null,
          starts: p.starts,
          ends: p.ends,
          days: p.days,
          onDuty: onDutyAt.get(p.guard_id) === s.id,
        };
      });
    const mine = allShifts.filter((x) => x.siteId === s.id);
    return {
      id: s.id,
      name: s.name,
      client: s.client_name,
      district: s.district,
      required: s.guards_required,
      posted,
      onDuty: [...onDutyAt.values()].filter((site) => site === s.id).length,
      notArrived: mine.filter((x) => x.notArrived).length,
      week: days.map((date) => ({ date, count: mine.filter((x) => x.date === date).length })),
    };
  });

  const postedGuards = new Set((postings.data ?? []).map((p) => p.guard_id));
  const guardList: RosterGuard[] = (guards.data ?? []).map((g) => {
    const p = (postings.data ?? []).find((x) => x.guard_id === g.id);
    return {
      id: g.id,
      name: g.full_name,
      code: g.employee_code,
      phone: g.phone,
      posting: p ? { siteId: p.site_id, starts: p.starts, ends: p.ends, days: p.days } : null,
    };
  });

  const off = (offRoster.data ?? []).map((a) => {
    const g = one(a.profiles as unknown as Person | null);
    return {
      id: a.id,
      guardName: g?.full_name ?? "A guard",
      guardCode: g?.employee_code ?? "",
      guardPhone: g?.phone ?? null,
      siteName: one(a.sites as unknown as { name: string } | null)?.name ?? "a site",
      checkInAt: a.check_in_at ?? "",
    };
  });

  const needed = rows.reduce((n, r) => n + (r.required ?? 0), 0);
  const covered = rows.reduce((n, r) => n + Math.min(r.onDuty, r.required ?? r.onDuty), 0);
  const notArrived = allShifts.filter((s) => s.notArrived);
  const unposted = guardList.filter((g) => !postedGuards.has(g.id)).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Roster" />
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Posts filled now"
          value={needed ? `${covered} / ${needed}` : "—"}
          hint={needed ? (covered >= needed ? "Every site is staffed" : `${needed - covered} short across sites`) : "Set how many each site needs"}
          icon={Users}
          tone={needed && covered < needed ? "amber" : "emerald"}
        />
        <StatCard
          label="Not arrived"
          value={String(notArrived.length)}
          hint={notArrived.length ? "Shift started, guard not checked in" : "Everyone rostered is in"}
          icon={UserRoundX}
          tone={notArrived.length ? "rose" : "slate"}
        />
        <StatCard
          label="Off-roster check-ins"
          value={String(off.length)}
          hint={off.length ? "Waiting for your approval" : "Nothing to approve"}
          icon={ShieldQuestion}
          tone={off.length ? "amber" : "slate"}
        />
        <StatCard
          label="Guards without a post"
          value={String(unposted)}
          hint={unposted ? "Available for cover" : "Everyone is posted"}
          icon={CalendarRange}
          tone="sky"
        />
      </div>
      <RosterWorkspace
        sites={rows}
        shifts={allShifts}
        guards={guardList}
        days={days}
        notArrived={notArrived}
        offRoster={off}
        canEdit={!session.impersonating}
      />
    </div>
  );
}
