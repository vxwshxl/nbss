import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck,
  CalendarRange,
  Clock3,
  Gauge,
  MapPin,
  MapPinned,
  Radio,
  Settings2,
  Siren,
  Timer,
  TrendingUp,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import { SOS_KIND_LABEL, SOS_STATUS_LABEL, type SosKind, type SosStatus } from "@nbss/shared/sos";

import { SiteMap } from "@/components/console/site-map";
import { ExcelButton } from "@/components/crm/excel-button";
import { StatTile } from "@/components/crm/stat";
import { Card, CardTitle, Pill, Table } from "@/components/crm/ui";
import { AreaTrend, BarList, Ring } from "@/components/crm/viz";
import { Button } from "@/components/ui/button";
import { site as company } from "@/content/site";
import { requireRoleSession } from "@/lib/auth";
import { toRing } from "@/lib/fence";
import { clock, datesLabel, daysLabel, windowLabel } from "@/lib/roster";
import { SITE_SECTION_KEYS, siteHref } from "@/lib/site-workspace";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Site" };
export const dynamic = "force-dynamic";

const TZ = company.timeZone;
/** The request's clock, read once. */
function nowMs(): number {
  return Date.now();
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function at(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
}

function hours(minutes: number | null | undefined): string {
  if (!minutes) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const STATUS: Record<string, { label: string; tone: "green" | "gold" | "grey" | "red" | "ink" }> = {
  present: { label: "On time", tone: "green" },
  late: { label: "Late", tone: "gold" },
  pending_review: { label: "Needs review", tone: "ink" },
  rejected: { label: "Rejected", tone: "red" },
  absent: { label: "Absent", tone: "red" },
};

/**
 * One site as its own workspace, the way birdev opens a project: /console/sites/<id> is
 * the site's dashboard and /console/sites/<id>/<section> the rest, with the site's own
 * sidebar and the top bar's switcher to move between sites (lib/site-workspace.ts).
 * Everything here is that gate alone; the console dashboard is all of them together.
 */
export default async function SiteWorkspacePage({ params }: { params: Promise<{ id: string; section?: string[] }> }) {
  const { id, section } = await params;
  const tab = section?.[0] ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || (section?.length ?? 0) > 1 || !SITE_SECTION_KEYS.includes(tab)) notFound();

  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const { data: s } = await supabase
    .from("sites")
    .select(
      "id, name, client_name, address, district, lat, lng, geofence_radius_m, max_accuracy_m, polygon, shift_start, shift_end, grace_minutes, standard_shift_minutes, guards_required, active, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 29);
  const week = new Date(today);
  week.setDate(week.getDate() + 7);

  const [open, month, shifts, postings, sos] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, guard_id, check_in_at, status, profiles!attendance_guard_id_fkey(full_name, employee_code, phone)")
      .eq("site_id", id)
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, guard_id, check_in_at, check_out_at, worked_minutes, overtime_minutes, status, check_in_distance_m, profiles!attendance_guard_id_fkey(full_name, employee_code)")
      .eq("site_id", id)
      .gte("check_in_at", monthAgo.toISOString())
      .order("check_in_at", { ascending: false }),
    supabase
      .from("shifts")
      .select("id, guard_id, starts_at, ends_at, status, posting_id, guard:profiles!shifts_guard_id_fkey(full_name, employee_code, phone)")
      .eq("site_id", id)
      .neq("status", "cancelled")
      .gte("ends_at", today.toISOString())
      .lt("starts_at", week.toISOString())
      .order("starts_at"),
    supabase
      .from("site_postings")
      .select("id, guard_id, starts, ends, days, dates, profiles!site_postings_guard_id_fkey(full_name, employee_code, phone)")
      .eq("site_id", id)
      .eq("active", true),
    supabase
      .from("sos_alerts")
      .select("id, kind, status, raised_at, closed_at, guard:profiles!sos_alerts_raised_by_fkey(full_name)")
      .eq("site_id", id)
      .order("raised_at", { ascending: false })
      .limit(100),
  ]);

  const live = open.data ?? [];
  const rows = month.data ?? [];
  const upcoming = shifts.data ?? [];
  const posted = postings.data ?? [];
  const alerts = sos.data ?? [];

  const now = nowMs();
  const onDutyIds = new Set(live.map((r) => r.guard_id));
  const notArrived = upcoming.filter(
    (x) => x.status === "scheduled" && new Date(x.starts_at).getTime() + s.grace_minutes * 60_000 < now && new Date(x.ends_at).getTime() > now && !onDutyIds.has(x.guard_id),
  );
  const openSos = alerts.filter((a) => a.status === "active" || a.status === "acknowledged");
  const review = rows.filter((r) => r.status === "pending_review").length;
  const workedMins = rows.reduce((n, r) => n + (r.worked_minutes ?? 0), 0);
  const overtimeMins = rows.reduce((n, r) => n + (r.overtime_minutes ?? 0), 0);

  const ring = toRing(s.polygon);
  const mapSite = {
    id: s.id,
    name: s.name,
    client_name: s.client_name,
    district: s.district,
    lat: s.lat,
    lng: s.lng,
    geofence_radius_m: s.geofence_radius_m,
    ring,
    onDuty: live.length,
    assigned: new Set(posted.map((p) => p.guard_id)).size,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display-section truncate text-[clamp(1.6rem,3.4vw,2.4rem)] leading-tight">{s.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-secondary-fg">
            {[s.client_name, s.district].filter(Boolean).join(" · ") || "No client set"}
            {!s.active && <Pill tone="red">Paused</Pill>}
            {openSos.length > 0 && <Pill tone="red">{openSos.length} live SOS</Pill>}
          </p>
        </div>
        <div className="action-row w-full lg:w-auto">
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/console/roster?open=${s.id}`}>
              <CalendarRange data-icon="inline-start" />
              Post a guard
            </Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href={siteHref(s.id, "attendance")}>
              <CalendarCheck data-icon="inline-start" />
              Attendance
            </Link>
          </Button>
        </div>
      </div>

      {tab === "" && (
        <Overview
          siteId={s.id}
          required={s.guards_required}
          mapSite={mapSite}
          live={live.map((r) => {
            const g = one(r.profiles as unknown as { full_name: string; employee_code: string } | null);
            return { id: r.id, name: g?.full_name ?? "A guard", code: g?.employee_code ?? "", since: r.check_in_at, late: r.status === "late" };
          })}
          notArrived={notArrived.length}
          openSos={openSos.length}
          review={review}
          workedMins={workedMins}
          overtimeMins={overtimeMins}
          rows={rows}
          shiftsToday={upcoming.filter((x) => new Date(x.starts_at) < new Date(today.getTime() + 86_400_000))}
        />
      )}

      {tab === "roster" && (
        <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card>
            <CardTitle
              title={`Posted here · ${posted.length}`}
              hint={s.guards_required ? `Needs ${s.guards_required} on duty at once` : "Needs not set"}
              icon={Users}
              hue="jade"
              right={
                <Link href={`/console/roster?open=${s.id}`} className="text-sm font-medium text-primary-ink hover:underline">
                  Edit in roster
                </Link>
              }
            />
            {posted.length === 0 ? (
              <Empty>Nobody is posted here yet.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {posted.map((p) => {
                  const g = one(p.profiles as unknown as { full_name: string; employee_code: string } | null);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-3 text-[14px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{g?.full_name ?? "A guard"}</span>
                        <span className="block text-[12.5px] text-secondary-fg">
                          {windowLabel(p.starts, p.ends)} · {p.dates ? datesLabel(p.dates) : daysLabel(p.days)}
                        </span>
                      </span>
                      <Pill tone={p.dates ? "gold" : "green"}>{p.dates ? "Dated" : "Weekly"}</Pill>
                      {onDutyIds.has(p.guard_id) && <Pill tone="ink">On duty</Pill>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle
              title="Next seven days"
              hint="Every rostered shift here, posted and cover"
              icon={CalendarRange}
              hue="sky"
              right={
                <ExcelButton
                  title={`${s.name} roster`}
                  head={["Guard", "Code", "Starts", "Ends", "Kind", "State"]}
                  rows={upcoming.map((x) => {
                    const g = one(x.guard as unknown as { full_name: string; employee_code: string } | null);
                    return [g?.full_name ?? "", g?.employee_code ?? "", at(x.starts_at), at(x.ends_at), x.posting_id ? "Posted" : "Cover", x.status.replace("_", " ")];
                  })}
                />
              }
            />
            {upcoming.length === 0 ? (
              <Empty>No shifts in the next seven days.</Empty>
            ) : (
              <Table
                head={["Guard", "Starts", "Ends", "Kind", "State"]}
                rows={upcoming.map((x) => {
                  const g = one(x.guard as unknown as { full_name: string } | null);
                  return [
                    <span key="g" className="font-medium">{g?.full_name ?? "A guard"}</span>,
                    at(x.starts_at),
                    at(x.ends_at),
                    x.posting_id ? "Posted" : "Cover",
                    <Pill key="s" tone={x.status === "in_progress" ? "green" : x.status === "missed" ? "red" : "grey"}>
                      {x.status.replace("_", " ")}
                    </Pill>,
                  ];
                })}
              />
            )}
          </Card>
        </div>
      )}

      {tab === "attendance" && (
        <Card>
          <CardTitle
            title={`Punches · last 30 days · ${rows.length}`}
            hint="Every check-in at this gate"
            icon={CalendarCheck}
            hue="sky"
            right={
              <ExcelButton
                title={`${s.name} attendance`}
                head={["Guard", "Code", "In", "Out", "Worked (min)", "Overtime (min)", "From gate (m)", "Marked"]}
                rows={rows.map((r) => {
                  const g = one(r.profiles as unknown as { full_name: string; employee_code: string } | null);
                  return [
                    g?.full_name ?? "",
                    g?.employee_code ?? "",
                    at(r.check_in_at),
                    r.check_out_at ? at(r.check_out_at) : "On duty",
                    r.worked_minutes ?? 0,
                    r.overtime_minutes ?? 0,
                    r.check_in_distance_m != null ? Math.round(r.check_in_distance_m) : "",
                    STATUS[r.status]?.label ?? r.status,
                  ];
                })}
              />
            }
          />
          {rows.length === 0 ? (
            <Empty>No one has checked in here in the last 30 days.</Empty>
          ) : (
            <Table
              head={["Guard", "In", "Out", "Worked", "Overtime", "From gate", "Marked"]}
              align={["left", "left", "left", "right", "right", "right", "left"]}
              rows={rows.map((r) => {
                const g = one(r.profiles as unknown as { full_name: string; employee_code: string } | null);
                const st = STATUS[r.status] ?? { label: r.status, tone: "grey" as const };
                return [
                  <span key="g">
                    <span className="block font-medium">{g?.full_name ?? "A guard"}</span>
                    <span className="block font-mono text-[11.5px] text-secondary-fg">{g?.employee_code}</span>
                  </span>,
                  at(r.check_in_at),
                  r.check_out_at ? at(r.check_out_at) : <Pill key="o" tone="green">On duty</Pill>,
                  hours(r.worked_minutes),
                  hours(r.overtime_minutes),
                  r.check_in_distance_m != null ? `${Math.round(r.check_in_distance_m)} m` : "-",
                  <Pill key="m" tone={st.tone}>{st.label}</Pill>,
                ];
              })}
            />
          )}
          <p className="mt-4 text-[13px] text-secondary-fg">
            Approve or reject flagged punches in{" "}
            <Link href="/console/attendance" className="font-medium text-primary-ink hover:underline">
              Attendance
            </Link>
            .
          </p>
        </Card>
      )}

      {tab === "guards" && <GuardsHere siteName={s.name} rows={rows} posted={posted} onDuty={onDutyIds} />}

      {tab === "sos" && (
        <Card>
          <CardTitle
            title={`SOS alerts · ${alerts.length}`}
            hint="Raised at this site, newest first"
            icon={Siren}
            hue="brick"
            right={
              <ExcelButton
                title={`${s.name} SOS`}
                head={["Raised", "By", "Kind", "State", "Closed"]}
                rows={alerts.map((a) => [
                  at(a.raised_at),
                  one(a.guard as unknown as { full_name: string } | null)?.full_name ?? "",
                  SOS_KIND_LABEL[a.kind as SosKind] ?? a.kind,
                  SOS_STATUS_LABEL[a.status as SosStatus] ?? a.status,
                  at(a.closed_at),
                ])}
              />
            }
          />
          {alerts.length === 0 ? (
            <Empty>No SOS has ever been raised here.</Empty>
          ) : (
            <Table
              head={["Raised", "By", "Kind", "State", "Closed", ""]}
              rows={alerts.map((a) => {
                const g = one(a.guard as unknown as { full_name: string } | null);
                const live = a.status === "active" || a.status === "acknowledged";
                return [
                  at(a.raised_at),
                  g?.full_name ?? "A guard",
                  SOS_KIND_LABEL[a.kind as SosKind] ?? a.kind,
                  <Pill key="s" tone={live ? "red" : "grey"}>{SOS_STATUS_LABEL[a.status as SosStatus] ?? a.status}</Pill>,
                  at(a.closed_at),
                  <Link key="o" href={`/console/sos?alert=${a.id}`} className="text-sm font-medium text-primary-ink hover:underline">
                    Open
                  </Link>,
                ];
              })}
            />
          )}
        </Card>
      )}

      {tab === "settings" && (
        <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardTitle title="Boundary" hint={ring ? "A drawn outline" : `A circle of ${s.geofence_radius_m} m`} icon={MapPinned} hue="jade" />
            <SiteMap sites={[mapSite]} focus={s.id} height={360} />
          </Card>
          <Card>
            <CardTitle
              title="How attendance is judged"
              icon={Settings2}
              hue="gold"
              right={
                session.impersonating ? undefined : (
                  <Link href={`/console/sites?site=${s.id}`} className="text-sm font-medium text-primary-ink hover:underline">
                    Edit
                  </Link>
                )
              }
            />
            <dl className="grid gap-4 text-[14px] sm:grid-cols-2">
              <Fact label="Client" value={s.client_name} />
              <Fact label="District" value={s.district} />
              <Fact label="Address" value={s.address} wide />
              <Fact label="Shift" value={s.shift_start && s.shift_end ? `${clock(s.shift_start)} to ${clock(s.shift_end)}` : null} />
              <Fact label="Standard shift" value={hours(s.standard_shift_minutes)} />
              <Fact label="Grace before late" value={`${s.grace_minutes} min`} />
              <Fact label="Required GPS accuracy" value={`${s.max_accuracy_m} m`} />
              <Fact label="Guards needed at once" value={s.guards_required ? String(s.guards_required) : null} />
              <Fact label="Registered" value={at(s.created_at)} />
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}

type MonthRow = {
  guard_id: string;
  check_in_at: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  status: string;
  profiles: unknown;
};

function Overview({
  siteId,
  required,
  mapSite,
  live,
  notArrived,
  openSos,
  review,
  workedMins,
  overtimeMins,
  rows,
  shiftsToday,
}: {
  siteId: string;
  required: number | null;
  mapSite: React.ComponentProps<typeof SiteMap>["sites"][number];
  live: { id: string; name: string; code: string; since: string | null; late: boolean }[];
  notArrived: number;
  openSos: number;
  review: number;
  workedMins: number;
  overtimeMins: number;
  rows: MonthRow[];
  shiftsToday: { status: string }[];
}) {
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - (13 - i));
    return d;
  });
  const worked = new Map<string, number>();
  const extra = new Map<string, number>();
  const punches = new Map<string, number>();
  for (const r of rows) {
    if (!r.check_in_at) continue;
    const k = dayKey(new Date(r.check_in_at));
    worked.set(k, (worked.get(k) ?? 0) + (r.worked_minutes ?? 0));
    extra.set(k, (extra.get(k) ?? 0) + (r.overtime_minutes ?? 0));
    punches.set(k, (punches.get(k) ?? 0) + 1);
  }
  const labels = days.map((d) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ }));

  const live2 = shiftsToday.filter((x) => x.status !== "cancelled");
  const covered = live2.filter((x) => x.status === "in_progress" || x.status === "completed").length;
  const cover = required ? Math.min(100, Math.round((live.length / required) * 100)) : live2.length ? Math.round((covered / live2.length) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @4xl/main:grid-cols-4">
        <StatTile
          solid
          hue="jade"
          icon={Radio}
          label="On duty now"
          value={live.length}
          trend={days.map((d) => punches.get(dayKey(d)) ?? 0)}
          note={required ? `of ${required} needed` : "No headcount set"}
        />
        <StatTile hue={notArrived ? "brick" : "sky"} icon={Timer} label="Not arrived" value={notArrived} href={siteHref(siteId, "roster")} note={notArrived ? "Shift started, guard not in" : "Everyone rostered is in"} noteTone={notArrived ? "bad" : undefined} />
        <StatTile hue={openSos ? "brick" : "plum"} icon={Siren} label="Live SOS" value={openSos} href={siteHref(siteId, "sos")} note={openSos ? "Needs answering" : "Nothing outstanding"} noteTone={openSos ? "bad" : undefined} />
        <StatTile hue={review ? "gold" : "teal"} icon={TriangleAlert} label="Needs review" value={review} href={siteHref(siteId, "attendance")} note="Punches, last 30 days" />
        <StatTile hue="teal" icon={Clock3} label="Hours, 30 days" value={Math.round(workedMins / 60)} note={`${Math.round(overtimeMins / 60)} h overtime`} />
        <StatTile hue="sky" icon={CalendarCheck} label="Punches, 30 days" value={rows.length} href={siteHref(siteId, "attendance")} note={`${rows.filter((r) => r.status === "late").length} late`} />
        <StatTile hue="gold" icon={CalendarRange} label="Shifts today" value={live2.length} href={siteHref(siteId, "roster")} note={`${covered} covered so far`} />
        <StatTile hue="plum" icon={UserRound} label="Guards here, 30 days" value={new Set(rows.map((r) => r.guard_id)).size} href={siteHref(siteId, "guards")} note="Different people" />
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle title="Man-hours" hint="Last 14 days at this site" icon={TrendingUp} hue="jade" />
          <AreaTrend
            labels={labels}
            money={false}
            series={[
              { label: "Worked", hue: "jade", values: days.map((d) => Math.round((worked.get(dayKey(d)) ?? 0) / 60)) },
              { label: "Overtime", hue: "gold", values: days.map((d) => Math.round((extra.get(dayKey(d)) ?? 0) / 60)) },
            ]}
          />
        </Card>
        <Card>
          <CardTitle title="Cover now" hint={required ? "On duty against the headcount" : "Today's shifts with the guard in"} icon={Gauge} hue="teal" />
          <div className="grid place-items-center py-2">
            <Ring value={cover} hue={cover >= 100 ? "jade" : cover >= 50 ? "gold" : "brick"} label={`${cover}%`} sub="covered" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardTitle title="The gate" hint="Boundary and who is inside it" icon={MapPin} hue="sky" />
          <SiteMap sites={[mapSite]} focus={siteId} height={320} />
        </Card>
        <Card>
          <CardTitle title={`On duty · ${live.length}`} icon={Radio} hue="jade" />
          {live.length === 0 ? (
            <Empty>Nobody is checked in here right now.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {live.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-3 text-[14px]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-subtle text-xs font-semibold text-primary-ink">
                    {g.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{g.name}</span>
                    <span className="block font-mono text-[11.5px] text-secondary-fg">{g.code}</span>
                  </span>
                  <span className="text-right text-[12.5px] text-secondary-fg">
                    since {at(g.since)}
                    {g.late && (
                      <span className="block">
                        <Pill tone="gold">Late</Pill>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function GuardsHere({
  siteName,
  rows,
  posted,
  onDuty,
}: {
  siteName: string;
  rows: MonthRow[];
  posted: { guard_id: string; profiles: unknown }[];
  onDuty: Set<string>;
}) {
  const people = new Map<string, { name: string; code: string; mins: number; punches: number; late: number; posted: boolean }>();
  const touch = (id: string, p: unknown) => {
    const g = one(p as { full_name: string; employee_code: string } | null);
    const cur = people.get(id) ?? { name: g?.full_name ?? "A guard", code: g?.employee_code ?? "", mins: 0, punches: 0, late: 0, posted: false };
    people.set(id, cur);
    return cur;
  };
  for (const p of posted) touch(p.guard_id, p.profiles).posted = true;
  for (const r of rows) {
    const cur = touch(r.guard_id, r.profiles);
    cur.mins += r.worked_minutes ?? 0;
    cur.punches += 1;
    if (r.status === "late") cur.late += 1;
  }
  const list = [...people.entries()].sort((a, b) => b[1].mins - a[1].mins);
  const HUES = ["jade", "sky", "gold", "teal", "plum"] as const;

  return (
    <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card>
        <CardTitle
          title={`Guards · ${list.length}`}
          hint="Posted here, or worked here in the last 30 days"
          icon={Users}
          hue="jade"
          right={
            <ExcelButton
              title={`${siteName} guards`}
              head={["Guard", "Code", "Hours", "Punches", "Late", "Posted", "On duty"]}
              rows={list.map(([id, g]) => [g.name, g.code, Math.round((g.mins / 60) * 10) / 10, g.punches, g.late, g.posted ? "Yes" : "No", onDuty.has(id) ? "Yes" : "No"])}
            />
          }
        />
        {list.length === 0 ? (
          <Empty>No guard is posted here or has worked here recently.</Empty>
        ) : (
          <Table
            head={["Guard", "Hours", "Punches", "Late", ""]}
            align={["left", "right", "right", "right", "left"]}
            rows={list.map(([id, g]) => [
              <Link key="g" href={`/console/guards?person=${id}`} className="block hover:underline">
                <span className="block font-medium">{g.name}</span>
                <span className="block font-mono text-[11.5px] text-secondary-fg">{g.code}</span>
              </Link>,
              hours(g.mins),
              g.punches,
              g.late,
              <span key="t" className="flex gap-1.5">
                {g.posted && <Pill tone="green">Posted</Pill>}
                {onDuty.has(id) && <Pill tone="ink">On duty</Pill>}
              </span>,
            ])}
          />
        )}
      </Card>
      <Card>
        <CardTitle title="Most hours" hint="Last 30 days" icon={Clock3} hue="gold" />
        {list.some(([, g]) => g.mins > 0) ? (
          <BarList
            money={false}
            data={list
              .filter(([, g]) => g.mins > 0)
              .slice(0, 6)
              .map(([, g], i) => ({ label: g.name, value: Math.round(g.mins / 60), hue: HUES[i % HUES.length]!, sub: hours(g.mins) }))}
          />
        ) : (
          <Empty>No hours worked yet.</Empty>
        )}
      </Card>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12.5px] text-secondary-fg">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "-"}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center text-sm text-secondary-fg">{children}</p>;
}
