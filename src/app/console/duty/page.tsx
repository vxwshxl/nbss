import type { Metadata } from "next";
import { CalendarCheck, Clock3, Radio, Timer } from "lucide-react";

import {
  AttendanceWorkspace,
  type AttendanceRow,
} from "@/components/console/attendance-workspace";
import { PageHeader } from "@/components/console/page-header";
import { PunchControl, type PunchSite } from "@/components/console/punch-control";
import type { MapSite } from "@/components/console/site-map";
import { StatCard } from "@/components/console/stat-card";
import { Panel } from "@/components/ui/panel";
import { site } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

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

function toRing(value: Json | null): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const ring: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

/**
 * What a guard sees when they open the app at the start of a shift.
 *
 * Deliberately one screen with one decision on it. Everything above the punch
 * control exists to answer "can I press it yet"; everything below is the record
 * it has been producing, which is the only reason to trust that pressing it
 * matters.
 */
export default async function DutyPage() {
  const profile = await requireRole("guard");
  const supabase = await supabaseServer();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [openPunch, recent, siteList] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, check_in_at, site_id, status, sites(name, address)")
      .eq("guard_id", profile.id)
      .is("check_out_at", null)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select(
        "id, site_id, check_in_at, check_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m, check_in_method, check_out_distance_m, check_out_method, worked_minutes, overtime_minutes, status, device_reported_at, ip, review_note, reviewed_at, sites(name)",
      )
      .eq("guard_id", profile.id)
      .gte("check_in_at", ninetyDaysAgo.toISOString())
      .order("check_in_at", { ascending: false })
      .limit(500),
    supabase
      .from("sites")
      .select("id, name, client_name, district, lat, lng, geofence_radius_m, max_accuracy_m, polygon")
      .eq("active", true)
      .order("name"),
  ]);

  const open = openPunch.data;
  const history = recent.data ?? [];
  const openSite = open ? (Array.isArray(open.sites) ? open.sites[0] : open.sites) : null;

  const punchSites: PunchSite[] = (siteList.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    geofence_radius_m: s.geofence_radius_m,
    max_accuracy_m: s.max_accuracy_m,
    ring: toRing(s.polygon),
  }));

  const fences = new Map<string, MapSite>(
    (siteList.data ?? []).map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        client_name: s.client_name,
        district: s.district,
        lat: s.lat,
        lng: s.lng,
        geofence_radius_m: s.geofence_radius_m,
        ring: toRing(s.polygon),
        onDuty: 0,
        assigned: 0,
      },
    ]),
  );

  const sinceWeek = weekAgo.toISOString();
  const thisWeek = history.filter((r) => (r.check_in_at ?? "") >= sinceWeek);

  const weekMinutes = thisWeek.reduce((sum, r) => sum + (r.worked_minutes ?? 0), 0);
  const weekOvertime = thisWeek.reduce((sum, r) => sum + (r.overtime_minutes ?? 0), 0);

  const rows: AttendanceRow[] = history.map((r) => {
    const place = Array.isArray(r.sites) ? r.sites[0] : r.sites;
    return {
      id: r.id,
      check_in_at: r.check_in_at,
      check_out_at: r.check_out_at,
      check_in_lat: r.check_in_lat,
      check_in_lng: r.check_in_lng,
      check_in_accuracy_m: r.check_in_accuracy_m,
      check_in_distance_m: r.check_in_distance_m,
      check_in_method: r.check_in_method,
      check_out_distance_m: r.check_out_distance_m,
      check_out_method: r.check_out_method,
      worked_minutes: r.worked_minutes,
      overtime_minutes: r.overtime_minutes,
      status: r.status,
      device_reported_at: r.device_reported_at,
      ip: r.ip,
      review_note: r.review_note,
      reviewed_at: r.reviewed_at,
      guard_name: null,
      guard_code: null,
      site_name: place?.name ?? null,
      site: fences.get(r.site_id) ?? null,
    };
  });

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My shift" title={`${firstName}, here is your shift`} />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Right now"
          value={open ? "On duty" : "Off duty"}
          hint={
            open && open.check_in_at
              ? `${openSite?.name ?? "Your site"} since ${time(open.check_in_at)}`
              : "Not checked in"
          }
          icon={Radio}
          tone={open ? "emerald" : "slate"}
        />
        <StatCard
          label="Worked"
          value={hours(weekMinutes)}
          hint="Last 7 days"
          icon={Clock3}
          tone="indigo"
        />
        <StatCard
          label="Overtime"
          value={hours(weekOvertime)}
          hint="Last 7 days"
          icon={Timer}
          tone="violet"
        />
        <StatCard
          label="Shifts"
          value={String(thisWeek.length)}
          hint="Last 7 days"
          icon={CalendarCheck}
          tone="sky"
        />
      </div>

      <Panel
        tone={open ? "emerald" : "amber"}
        title={open ? "You are on duty" : "Check in"}
        icon={open ? Radio : Clock3}
      >
        <PunchControl
          sites={punchSites}
          openPunch={
            open && open.check_in_at
              ? {
                  siteId: open.site_id,
                  siteName: openSite?.name ?? "your site",
                  since: time(open.check_in_at),
                }
              : null
          }
        />
      </Panel>

      <Panel
        tone="slate"
        title="My shifts"
        icon={CalendarCheck}
        bodyClassName="p-3 sm:p-4"
      >
        <AttendanceWorkspace rows={rows} canReview={false} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Your hours are calculated by the system from the times you check in and out.
        If something here looks wrong, tell your supervisor — corrections are
        recorded, never silent.
      </p>
    </div>
  );
}
