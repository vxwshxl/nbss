import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarRange,
  Clock3,
  Gauge,
  MapPinned,
  Radio,
  Siren,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import {
  LiveSosPanel,
  NotArrivedPanel,
  OnDutyTable,
  type LiveSos,
  type NotArrivedRow,
  type OnDutyRow,
} from "@/components/console/dashboard-tables";
import { Card, CardTitle, Hello } from "@/components/crm/ui";
import { StatTile } from "@/components/crm/stat";
import { AreaTrend, BarList, DonutChart, Ring } from "@/components/crm/viz";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { requireRoleSession } from "@/lib/auth";
import { site } from "@/content/site";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * Timestamps are stored as UTC and this renders on the server, which on the
 * host is a box in some other continent rather than a desk in Kokrajhar. The
 * zone is pinned to IST and printed, so a time on this page says what it means.
 */
function time(iso: string): string {
  return `${new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: site.timeZone,
  })} IST`;
}

function hours(minutes: number | null): string {
  if (minutes === null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Milliseconds since a moment. */
function since(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

/** How long someone has been standing at a gate, from their check-in stamp. */
function elapsed(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return hours(mins);
}

export default async function ConsoleDashboard() {
  const session = await requireRoleSession("admin", "supervisor");
  const profile = session.profile;
  const supabase = await supabaseServer();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const monthAgo = new Date(startOfToday);
  monthAgo.setDate(monthAgo.getDate() - 29);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [guards, sites, onDuty, todayPunches, liveSos, dueShifts, month, todayShifts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "guard")
      .eq("active", true),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("attendance")
      .select(
        "id, guard_id, site_id, check_in_at, status, profiles!attendance_guard_id_fkey(full_name, employee_code), sites(name, district)",
      )
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, worked_minutes, overtime_minutes, status")
      .gte("check_in_at", startOfToday.toISOString()),
    supabase
      .from("sos_alerts")
      .select("id, status, kind, raised_at, guard:profiles!sos_alerts_raised_by_fkey(full_name, phone), sites(name)")
      .in("status", ["active", "acknowledged"])
      .order("raised_at", { ascending: false }),
    // Rostered shifts that have started and are not yet over, still waiting for
    // their guard — "not arrived" once the site's grace period has passed.
    supabase
      .from("shifts")
      .select("id, guard_id, site_id, starts_at, guard:profiles!shifts_guard_id_fkey(full_name, phone), sites(name, grace_minutes)")
      .eq("status", "scheduled")
      .lte("starts_at", new Date().toISOString())
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
    // The last 30 days of punches, for the charts.
    supabase
      .from("attendance")
      .select("check_in_at, worked_minutes, overtime_minutes, status, sites(name)")
      .gte("check_in_at", monthAgo.toISOString()),
    supabase
      .from("shifts")
      .select("status")
      .gte("starts_at", startOfToday.toISOString())
      .lt("starts_at", endOfToday.toISOString()),
  ]);

  const live = onDuty.data ?? [];
  const punches = todayPunches.data ?? [];

  const overtimeToday = punches.reduce((sum, p) => sum + (p.overtime_minutes ?? 0), 0);
  const lateToday = punches.filter((p) => p.status === "late").length;
  const needsReview = punches.filter((p) => p.status === "pending_review").length;

  const noSites = (sites.count ?? 0) === 0;

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const alerts: LiveSos[] = (liveSos.data ?? []).map((a) => {
    const g = one(a.guard as unknown as { full_name: string; phone: string | null } | null);
    return {
      id: a.id,
      status: a.status,
      kind: a.kind,
      guardName: g?.full_name ?? "A guard",
      guardPhone: g?.phone ?? null,
      siteName: one(a.sites as unknown as { name: string } | null)?.name ?? "a site",
      raised: time(a.raised_at),
    };
  });

  const checkedIn = new Set(live.map((r) => `${r.guard_id}:${r.site_id}`));
  const notArrived: NotArrivedRow[] = (dueShifts.data ?? []).flatMap((s) => {
    const place = one(s.sites as unknown as { name: string; grace_minutes: number } | null);
    const lateBy = since(s.starts_at);
    if (lateBy < (place?.grace_minutes ?? 10) * 60_000 || checkedIn.has(`${s.guard_id}:${s.site_id}`)) return [];
    const g = one(s.guard as unknown as { full_name: string; phone: string | null } | null);
    return [
      {
        id: s.id,
        guardName: g?.full_name ?? "A guard",
        guardPhone: g?.phone ?? null,
        siteName: place?.name ?? "a site",
        due: time(s.starts_at),
        late: hours(Math.round(lateBy / 60_000)),
      },
    ];
  });

  const onDutyRows: OnDutyRow[] = live.map((row) => {
    // An embedded to-one relationship comes back as an object, but PostgREST's
    // generated types describe the general case — so both shapes are handled.
    const guard = one(row.profiles as unknown as { full_name: string; employee_code: string } | null);
    const place = one(row.sites as unknown as { name: string; district: string | null } | null);
    return {
      id: row.id,
      guardName: guard?.full_name ?? "-",
      guardCode: guard?.employee_code ?? "",
      siteName: place?.name ?? "-",
      district: place?.district ?? null,
      since: row.check_in_at ? time(row.check_in_at) : "-",
      forHowLong: row.check_in_at ? elapsed(row.check_in_at) : "-",
      late: row.status === "late",
    };
  });
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  // ---- charts: the last 14 days of hours, how punches were marked, the busiest sites.
  const monthRows = (month.data ?? []).filter((r): r is typeof r & { check_in_at: string } => !!r.check_in_at);
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: site.timeZone });
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - (13 - i));
    return d;
  });
  const worked = new Map<string, number>();
  const extra = new Map<string, number>();
  for (const r of monthRows) {
    const k = dayKey(new Date(r.check_in_at));
    worked.set(k, (worked.get(k) ?? 0) + (r.worked_minutes ?? 0));
    extra.set(k, (extra.get(k) ?? 0) + (r.overtime_minutes ?? 0));
  }
  const dayLabels = days.map((d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: site.timeZone }));
  const workedSeries = days.map((d) => Math.round((worked.get(dayKey(d)) ?? 0) / 60));
  const extraSeries = days.map((d) => Math.round((extra.get(dayKey(d)) ?? 0) / 60));
  const punchesByDay = days.map((d) => monthRows.filter((r) => dayKey(new Date(r.check_in_at)) === dayKey(d)).length);

  const count = (st: string) => monthRows.filter((r) => r.status === st).length;
  const marked = [
    { label: "On time", value: count("present"), hue: "jade" as const },
    { label: "Late", value: count("late"), hue: "gold" as const },
    { label: "Needs review", value: count("pending_review"), hue: "sky" as const },
    { label: "Rejected", value: count("rejected"), hue: "brick" as const },
  ];

  const bySite = new Map<string, number>();
  for (const r of monthRows) {
    const name = (Array.isArray(r.sites) ? r.sites[0]?.name : (r.sites as { name?: string } | null)?.name) ?? "Unknown site";
    bySite.set(name, (bySite.get(name) ?? 0) + (r.worked_minutes ?? 0));
  }
  const SITE_HUES = ["jade", "sky", "gold", "teal", "plum"] as const;
  const busiest = [...bySite.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, mins], i) => ({ label, value: Math.round(mins / 60), hue: SITE_HUES[i % SITE_HUES.length]!, sub: `${Math.round(mins / 60)} h` }));

  const shiftsToday = (todayShifts.data ?? []).filter((r) => r.status !== "cancelled");
  const covered = shiftsToday.filter((r) => r.status === "in_progress" || r.status === "completed").length;
  const coverPct = shiftsToday.length ? Math.round((covered / shiftsToday.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Hello
        name={profile.full_name || firstName}
        actions={
          <>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/console/roster">
                <CalendarRange data-icon="inline-start" />
                Roster
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/console/attendance">
                <CalendarCheck data-icon="inline-start" />
                Attendance
              </Link>
            </Button>
          </>
        }
      />

      {alerts.length > 0 && <LiveSosPanel alerts={alerts} />}
      {notArrived.length > 0 && <NotArrivedPanel rows={notArrived} />}

      {/* birdev's stat tiles: the first solid, the rest through the hues, a figure that
          needs someone in brick. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @4xl/main:grid-cols-4">
        <StatTile solid hue="jade" icon={Radio} label="On duty now" value={live.length} href="/console/attendance" trend={punchesByDay} note={live.length ? `Across ${new Set(live.map((r) => r.site_id)).size} sites` : "Nobody is checked in"} />
        <StatTile hue="sky" icon={UserRound} label="Active guards" value={guards.count ?? 0} href="/console/guards" note="With a working login" />
        <StatTile hue="gold" icon={MapPinned} label="Sites" value={sites.count ?? 0} href="/console/sites" note="Each with its own geofence" />
        <StatTile hue={needsReview ? "brick" : "teal"} icon={TriangleAlert} label="Needs review" value={needsReview} href="/console/attendance" note={needsReview ? "A punch the fence could not confirm" : "Nothing outstanding"} noteTone={needsReview ? "bad" : undefined} />
        <StatTile hue={lateToday ? "brick" : "plum"} icon={Timer} label="Late today" value={lateToday} note={lateToday ? "Past the site's grace window" : "Everyone arrived on time"} noteTone={lateToday ? "bad" : undefined} />
        <StatTile hue="teal" icon={Clock3} label="Overtime today" value={Math.round(overtimeToday / 60)} note={`${hours(overtimeToday)} from punch pairs`} />
        <StatTile hue="sky" icon={CalendarRange} label="Shifts today" value={shiftsToday.length} href="/console/roster" note={`${covered} covered so far`} />
        <StatTile hue="jade" icon={CalendarCheck} label="Punches, 30 days" value={monthRows.length} note={`${marked[0]!.value} on time`} />
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle title="Man-hours" hint="Last 14 days, worked and overtime" icon={TrendingUp} hue="jade" right={<Link href="/console/attendance" className="text-sm font-medium text-primary-ink hover:underline">Ledger</Link>} />
          <AreaTrend
            labels={dayLabels}
            money={false}
            series={[
              { label: "Worked", hue: "jade", values: workedSeries },
              { label: "Overtime", hue: "gold", values: extraSeries },
            ]}
          />
        </Card>
        <Card>
          <CardTitle title="Shift cover today" hint="Rostered shifts with the guard on site" icon={Gauge} hue="teal" />
          <div className="grid place-items-center py-2">
            <Ring value={coverPct} hue="teal" label={`${coverPct}%`} sub="covered" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="hue-sky rounded-2xl bg-[var(--h-soft)] p-3 text-[var(--h-deep)]">
              <p className="flex items-center gap-1.5 text-[13px] font-medium"><CalendarRange className="size-4" /> Rostered</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{shiftsToday.length}</p>
            </div>
            <div className="hue-gold rounded-2xl bg-[var(--h-soft)] p-3 text-[var(--h-deep)]">
              <p className="flex items-center gap-1.5 text-[13px] font-medium"><Siren className="size-4" /> Live SOS</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{alerts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-2">
        <Card>
          <CardTitle title="How punches were marked" hint="Last 30 days" icon={CalendarCheck} hue="sky" />
          <DonutChart data={marked} total="punches" money={false} />
        </Card>
        <Card>
          <CardTitle title="Busiest sites" hint="Hours worked, last 30 days" icon={Building2} hue="gold" right={<Link href="/console/sites" className="text-sm font-medium text-primary-ink hover:underline">All sites</Link>} />
          {busiest.length ? (
            <BarList data={busiest} money={false} />
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-secondary-fg">No hours worked yet.</p>
          )}
        </Card>
      </div>

      {/* Only ever shown on a genuinely empty system. It is the one moment where
          a console should tell you what to do next rather than what is true. */}
      {noSites && (
        <Panel tone="amber" title="Start here" icon={Building2}>
          <p className="max-w-2xl text-sm text-muted-foreground">
            No sites are registered yet. A guard cannot check in until there is a site with
            a geofence around it. That fence is what makes attendance mean{" "}
            <em>actually at the gate</em> rather than <em>tapped a button</em>.
          </p>
          <Button asChild className="mt-4">
            <Link href="/console/sites">
              Register the first site
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </Panel>
      )}

      <Panel
        tone="emerald"
        title="On duty now"
        icon={Radio}
        bodyClassName="p-0 sm:p-0"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/console/attendance">
              All attendance
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        }
      >
        {live.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Radio className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-medium">Nobody is checked in.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              When a guard punches in at a site, they appear here with the time they
              arrived and how long they have been standing.
            </p>
          </div>
        ) : (
          <OnDutyTable rows={onDutyRows} canReview={!session.impersonating} />
        )}
      </Panel>
    </div>
  );
}
