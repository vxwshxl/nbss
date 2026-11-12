import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck, CalendarX2, Clock, Grid3x3, MapPin, Percent, Radio, Users } from "lucide-react";

import { GuardCards, Legend, MonthGrid } from "@/components/console/attendance-views";
import { OUTCOME, RANK } from "@/components/console/attendance-key";
import { PageHeader } from "@/components/console/page-header";
import { PeopleTabs } from "@/components/console/people-tabs";
import { PeriodNav } from "@/components/console/period-nav";
import { StatCard } from "@/components/console/stat-card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { CAME, registerBetween, tallyRegister, type Outcome, type RegisterEntry } from "@/lib/attendance-register";
import { requireRole } from "@/lib/auth";
import { peopleIds, readPeople } from "@/lib/people";
import { istDate } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Site report" };
export const dynamic = "force-dynamic";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function nowMs(): number {
  return Date.now();
}

/** Every day from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end && out.length < 400; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** A day's mark for one guard: the worst of the check-ins if they came, else the worst duty. */
function mark(list: RegisterEntry[]): Outcome | null {
  const attended = list.filter((r) => CAME.includes(r.outcome));
  const pool = attended.length ? attended : list;
  return pool.length ? RANK.find((o) => pool.some((r) => r.outcome === o))! : null;
}

/**
 * One site's attendance for a period: who is posted there, who came and who did not
 * today, the register as a grid (a row per guard, a letter per day), and each guard's
 * figures. The same register as the Attendance page, filtered to the site.
 */
export default async function SiteReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; people?: string }>;
}) {
  await requireRole("admin", "supervisor");
  const [{ id: raw }, q] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(raw)) notFound();
  const id = raw.toLowerCase();
  const people = readPeople(q.people);
  const today = istDate(new Date());
  let from = isDate(q.from) ? q.from! : `${today.slice(0, 8)}01`;
  let to = isDate(q.to) ? q.to! : today;
  if (from > to) [from, to] = [to, from];

  const supabase = await supabaseServer();
  const { data: site } = await supabase.from("sites").select("id, name, district, guards_required, active").eq("id", id).maybeSingle();
  if (!site) notFound();

  const ids = await peopleIds(supabase, people);
  const [rows, { data: postings }] = await Promise.all([
    registerBetween(supabase, from, to, { siteId: id, now: nowMs(), guardIds: ids }),
    supabase
      .from("site_postings")
      .select("guard_id, profiles!site_postings_guard_id_fkey(full_name, employee_code)")
      .eq("site_id", id)
      .eq("active", true),
  ]);

  const keep = ids ? new Set(ids) : null;
  const posted = new Map<string, { id: string; name: string; code: string }>();
  for (const p of postings ?? []) {
    if (!p.guard_id || (keep && !keep.has(p.guard_id))) continue;
    const g = one(p.profiles as unknown as { full_name: string; employee_code: string } | null);
    posted.set(p.guard_id, { id: p.guard_id, name: g?.full_name ?? "A guard", code: g?.employee_code ?? "" });
  }

  const t = tallyRegister(rows);
  const came = new Set(rows.filter((r) => CAME.includes(r.outcome)).map((r) => r.guardId)).size;
  const days = daysBetween(from, to);

  // Today, guard by guard: everyone posted here, and anyone else with a duty or a punch here today.
  const showToday = from <= today && today <= to;
  const todayRows = rows.filter((r) => r.day === today);
  const todayPeople = new Map(posted);
  for (const r of todayRows) if (!todayPeople.has(r.guardId)) todayPeople.set(r.guardId, { id: r.guardId, name: r.guardName, code: r.guardCode });
  const todayList = [...todayPeople.values()]
    .map((g) => ({ ...g, posted: posted.has(g.id), outcome: mark(todayRows.filter((r) => r.guardId === g.id)) }))
    .sort((a, b) => (a.outcome ? RANK.indexOf(a.outcome) : 99) - (b.outcome ? RANK.indexOf(b.outcome) : 99) || a.name.localeCompare(b.name));
  const count = (...o: Outcome[]) => todayList.filter((g) => g.outcome && o.includes(g.outcome)).length;
  const todaySummary = [
    `${count("on_duty")} on duty`,
    `${count("present", "late", "review", "off_roster")} done`,
    `${count("absent")} absent`,
    `${count("not_arrived")} not arrived`,
    `${count("upcoming")} still to start`,
  ].join(" · ");

  const period = `from=${from}&to=${to}${people !== "all" ? `&people=${people}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/console/reports?${period}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/console/attendance?site=${id}`}>
              <CalendarCheck data-icon="inline-start" /> Attendance here
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/console/sites/${id}`}>
              <MapPin data-icon="inline-start" /> Site workspace
            </Link>
          </Button>
        </div>
      </div>
      <PageHeader
        title={site.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {site.district && <span className="rounded-full border border-app-line bg-card px-3 py-1.5 text-sm text-muted-foreground">{site.district}</span>}
            {!site.active && <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700">Out of service</span>}
            <PeopleTabs value={people} />
          </div>
        }
      />
      <PeriodNav from={from} to={to} />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Guards posted" value={String(posted.size)} hint={`Needs ${site.guards_required ?? "-"} on duty · ${came} came`} icon={Users} tone="amber" />
        <StatCard label="Present" value={String(t.present)} hint={`${t.late} late`} icon={CalendarCheck} tone="emerald" />
        <StatCard label="Absent" value={String(t.absent)} hint="Rostered, no check-in" icon={CalendarX2} tone={t.absent ? "rose" : "slate"} />
        <StatCard label="Hours" value={(t.minutes / 60).toFixed(1)} hint={`${from} to ${to}`} icon={Clock} tone="sky" />
        <StatCard label="Attendance" value={t.rate == null ? "-" : `${t.rate}%`} hint={`${t.due} duties due`} icon={Percent} tone="violet" />
      </div>

      {showToday && (
        <Panel tone="emerald" icon={Radio} title={`Today · ${todaySummary}`} bodyClassName="p-3 sm:p-4">
          {todayList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nobody is posted here and nobody has a duty today.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {todayList.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/console/reports/guard/${g.id}?from=${from}&to=${to}`}
                    className="press flex items-center justify-between gap-3 rounded-xl border border-app-line bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{g.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        <span className="font-mono">{g.code}</span>
                        {!g.posted && " · not posted here"}
                      </span>
                    </span>
                    {g.outcome ? (
                      <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", OUTCOME[g.outcome].cell)}>
                        {OUTCOME[g.outcome].label}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">No duty today</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel tone="sky" icon={Grid3x3} title="Register, day by day" bodyClassName="space-y-4 p-3 sm:p-4">
        <MonthGrid rows={rows} days={days} today={today} />
        <Legend />
      </Panel>

      <Panel tone="violet" icon={Users} title="Each guard's figures" bodyClassName="p-3 sm:p-4">
        <GuardCards rows={rows} />
      </Panel>
    </div>
  );
}
