import type { Metadata } from "next";
import { CalendarCheck, Clock3, Phone, Radio, ShieldCheck, Timer } from "lucide-react";

import { ClientDutyTable } from "@/components/console/client-duty-table";
import { PageHeader } from "@/components/console/page-header";
import { SiteMap, type MapSite } from "@/components/console/site-map";
import { StatCard } from "@/components/console/stat-card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { site as company, tel } from "@/content/site";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { toRing } from "@/lib/fence";

export const metadata: Metadata = { title: "My site" };
export const dynamic = "force-dynamic";

function time(iso: string): string {
  return `${new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: company.timeZone,
  })} IST`;
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

/** How long someone has been at the gate, from their check-in stamp. */
function elapsed(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${String(mins % 60).padStart(2, "0")}m` : `${mins}m`;
}

/**
 * What a client sees: who is on duty at their site, and the man-hours behind
 * the invoice.
 *
 * Deliberately narrower than the supervisor's view, and the line is drawn on
 * purpose. A client is entitled to know their site is staffed and what they are
 * being billed for. They are not entitled to a guard's coordinates, their
 * accuracy readings, or their attendance anywhere else — so this page shows
 * presence and totals, and there is no evidence trail on it at all.
 *
 * Which rows reach here is decided in Postgres, not by a filter written on this
 * page — a `WHERE` clause in a page is a disclosure waiting for someone to
 * refactor it away. But the mechanism is a view rather than a policy, and the
 * difference matters: row level security filters rows, and an attendance row
 * carries the guard's coordinates, accuracy readings and the object key of their
 * check-in selfie. `client_attendance` (0004_client_scoping.sql) exposes only the
 * ten columns above, filtered to `sites.client_id = auth.uid()`, and `attendance`
 * itself stays closed to clients entirely.
 */
export default async function ClientSitePage() {
  const profile = await requireRole("client");
  const supabase = await supabaseServer();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [onDuty, month, sites] = await Promise.all([
    supabase
      .from("client_attendance")
      .select("id, site_id, site_name, guard_name, check_in_at")
      .is("check_out_at", null)
      .order("check_in_at", { ascending: false }),
    supabase
      .from("client_attendance")
      .select("worked_minutes, overtime_minutes, status")
      .gte("check_in_at", monthStart.toISOString()),
    supabase
      .from("sites")
      .select("id, name, client_name, district, lat, lng, geofence_radius_m, polygon")
      .eq("active", true),
  ]);

  const live = onDuty.data ?? [];
  const punches = month.data ?? [];

  const manMinutes = punches.reduce((sum, p) => sum + (p.worked_minutes ?? 0), 0);
  const overtime = punches.reduce((sum, p) => sum + (p.overtime_minutes ?? 0), 0);

  const onDutyBySite = new Map<string, number>();
  for (const row of live) {
    if (!row.site_id) continue;
    onDutyBySite.set(row.site_id, (onDutyBySite.get(row.site_id) ?? 0) + 1);
  }

  const mapSites: MapSite[] = (sites.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: s.client_name,
    district: s.district,
    lat: s.lat,
    lng: s.lng,
    geofence_radius_m: s.geofence_radius_m,
    ring: toRing(s.polygon),
    onDuty: onDutyBySite.get(s.id) ?? 0,
    assigned: 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="My site" title="Deployment" />

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="On duty now"
          value={String(live.length)}
          hint={live.length ? "Verified at the boundary" : "Nobody is checked in"}
          icon={Radio}
          tone={live.length ? "emerald" : "slate"}
        />
        <StatCard
          label="Man-hours"
          value={hours(manMinutes)}
          hint="This month"
          icon={Clock3}
          tone="indigo"
        />
        <StatCard
          label="Of which overtime"
          value={hours(overtime)}
          hint="This month"
          icon={Timer}
          tone="violet"
        />
        <StatCard
          label="Shifts"
          value={String(punches.length)}
          hint="This month"
          icon={CalendarCheck}
          tone="sky"
        />
      </div>

      {mapSites.length > 0 && (
        <Panel
          tone="sky"
          title="Your site"
          icon={ShieldCheck}
          bodyClassName="p-0 sm:p-0"
        >
          <SiteMap sites={mapSites} height={320} className="rounded-none border-0" />
        </Panel>
      )}

      <Panel tone="emerald" title="On duty now" icon={Radio} bodyClassName="p-0 sm:p-0">
        {live.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Radio className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-sm font-medium">Nobody is checked in.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Guards appear here from the moment they arrive on site and mark
              themselves present at the boundary.
            </p>
          </div>
        ) : (
          <ClientDutyTable
            deskPhone={company.phone}
            rows={live.map((row, i) => ({
              id: row.id ?? String(i),
              guardName: row.guard_name ?? "—",
              siteName: row.site_name ?? "—",
              since: row.check_in_at ? time(row.check_in_at) : "—",
              forHowLong: row.check_in_at ? elapsed(row.check_in_at) : "—",
            }))}
          />
        )}
      </Panel>

      <Panel tone="slate" title="Anything not right?" icon={Phone}>
        <div className="flex flex-wrap items-center gap-4">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Man-hours are computed from the times guards checked in and out at your
            site, each one verified against its boundary. The deployment desk is
            staffed around the clock. Signed in as {profile.full_name}.
          </p>
          <Button asChild>
            <a href={`tel:${tel(company.phone)}`}>
              <Phone data-icon="inline-start" />
              {company.phone}
            </a>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
