import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  MapPinned,
  Radio,
  ShieldUser,
  Timer,
  TriangleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/console/page-header";
import { StatCard } from "@/components/console/stat-card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
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
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** How long someone has been standing at a gate, from their check-in stamp. */
function elapsed(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return hours(mins);
}

export default async function ConsoleDashboard() {
  const profile = await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [guards, sites, onDuty, todayPunches] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "guard")
      .eq("active", true),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("active", true),
    supabase
      .from("attendance")
      .select(
        "id, guard_id, site_id, check_in_at, status, profiles(full_name, employee_code), sites(name, district)",
      )
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, worked_minutes, overtime_minutes, status")
      .gte("check_in_at", startOfToday.toISOString()),
  ]);

  const live = onDuty.data ?? [];
  const punches = todayPunches.data ?? [];

  const overtimeToday = punches.reduce((sum, p) => sum + (p.overtime_minutes ?? 0), 0);
  const lateToday = punches.filter((p) => p.status === "late").length;
  const needsReview = punches.filter((p) => p.status === "pending_review").length;

  const noSites = (sites.count ?? 0) === 0;
  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${firstName}`}
        action={
          <Button asChild variant="outline">
            <Link href="/console/attendance">
              <CalendarCheck data-icon="inline-start" />
              Attendance
            </Link>
          </Button>
        }
      />

      {/* Six figures, and the order is the order someone actually scans them:
          what is happening right now, then the standing establishment, then the
          two numbers that mean somebody has to do something. */}
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="On duty now"
          value={String(live.length)}
          hint={
            live.length === 0
              ? "Nobody is checked in"
              : `Across ${new Set(live.map((r) => r.site_id)).size} site${
                  new Set(live.map((r) => r.site_id)).size === 1 ? "" : "s"
                }`
          }
          icon={Radio}
          tone="emerald"
          href="/console/attendance"
          cta="See the ledger"
        />
        <StatCard
          label="Active guards"
          value={String(guards.count ?? 0)}
          hint="With a working login"
          icon={ShieldUser}
          tone="indigo"
          href="/console/guards"
          cta="Manage guards"
        />
        <StatCard
          label="Sites"
          value={String(sites.count ?? 0)}
          hint="Each with its own geofence"
          icon={MapPinned}
          tone="sky"
          href="/console/sites"
          cta="Open the map"
        />
        <StatCard
          label="Late today"
          value={String(lateToday)}
          hint={lateToday ? "Past the site's grace window" : "Everyone arrived on time"}
          icon={Timer}
          tone={lateToday ? "amber" : "slate"}
        />
        <StatCard
          label="Overtime today"
          value={hours(overtimeToday)}
          hint="Computed from punch pairs"
          icon={CalendarCheck}
          tone="violet"
        />
        <StatCard
          label="Needs review"
          value={String(needsReview)}
          hint={needsReview ? "A punch the fence could not confirm" : "Nothing outstanding"}
          icon={TriangleAlert}
          tone={needsReview ? "rose" : "slate"}
          href={needsReview ? "/console/attendance" : undefined}
          cta="Review"
        />
      </div>

      {/* Only ever shown on a genuinely empty system. It is the one moment where
          a console should tell you what to do next rather than what is true. */}
      {noSites && (
        <Panel tone="amber" title="Start here" icon={Building2}>
          <p className="max-w-2xl text-sm text-muted-foreground">
            No sites are registered yet. A guard cannot check in until there is a site with
            a geofence around it — that fence is what makes attendance mean{" "}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guard</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Checked in</TableHead>
                  <TableHead className="text-right">On duty for</TableHead>
                  <TableHead className="text-right">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.map((row) => {
                  // An embedded to-one relationship comes back as an object,
                  // but PostgREST's generated types describe the general case —
                  // so both shapes are handled rather than cast away.
                  const guard = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                  const place = Array.isArray(row.sites) ? row.sites[0] : row.sites;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{guard?.full_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {guard?.employee_code ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="block">{place?.name ?? "—"}</span>
                        {place?.district && (
                          <span className="block text-xs text-muted-foreground">
                            {place.district}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.check_in_at ? time(row.check_in_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.check_in_at ? elapsed(row.check_in_at) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusPill status={row.status === "late" ? "late" : "on_duty"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
