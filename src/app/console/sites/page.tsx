import type { Metadata } from "next";

import { PageHeader } from "@/components/console/page-header";
import { SiteForm } from "@/components/console/site-form";
import { SitesWorkspace, type SiteRow } from "@/components/console/sites-workspace";
import { requireRoleSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Sites" };
export const dynamic = "force-dynamic";

/**
 * A polygon column is `Json`, so it is narrowed here rather than cast in the
 * client. Anything that is not a list of `[lng, lat]` pairs is treated as no
 * polygon at all, because a fence drawn from malformed data is worse than no
 * fence — it looks authoritative.
 */
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

export default async function SitesPage() {
  const session = await requireRoleSession("admin", "supervisor");
  const supabase = await supabaseServer();

  const [sites, live, shifts] = await Promise.all([
    supabase
      .from("sites")
      .select(
        "id, name, client_name, address, district, lat, lng, geofence_radius_m, max_accuracy_m, polygon, shift_start, shift_end, grace_minutes, standard_shift_minutes, active, created_at",
      )
      .order("name"),
    // Who is standing in each fence right now. An open punch — checked in, not
    // yet checked out — is the only honest definition of "on duty".
    supabase.from("attendance").select("site_id").is("check_out_at", null),
    // Who is rostered there at all, so an empty site reads as "nobody is here
    // yet" rather than "nobody works here".
    supabase
      .from("shifts")
      .select("site_id, guard_id")
      .in("status", ["scheduled", "in_progress"]),
  ]);

  const onDutyBySite = new Map<string, number>();
  for (const row of live.data ?? []) {
    onDutyBySite.set(row.site_id, (onDutyBySite.get(row.site_id) ?? 0) + 1);
  }

  // Distinct guards per site: one guard with four shifts at a gate is one
  // person assigned to it, not four.
  const assignedBySite = new Map<string, Set<string>>();
  for (const row of shifts.data ?? []) {
    const set = assignedBySite.get(row.site_id) ?? new Set<string>();
    set.add(row.guard_id);
    assignedBySite.set(row.site_id, set);
  }

  const rows: SiteRow[] = (sites.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    client_name: s.client_name,
    address: s.address,
    district: s.district,
    lat: s.lat,
    lng: s.lng,
    geofence_radius_m: s.geofence_radius_m,
    max_accuracy_m: s.max_accuracy_m,
    ring: toRing(s.polygon),
    shift_start: s.shift_start,
    shift_end: s.shift_end,
    grace_minutes: s.grace_minutes,
    standard_shift_minutes: s.standard_shift_minutes,
    active: s.active,
    created_at: s.created_at,
    onDuty: onDutyBySite.get(s.id) ?? 0,
    assigned: assignedBySite.get(s.id)?.size ?? 0,
  }));

  // An admin viewing as someone else must not be able to move a fence in that
  // person's name — so the controls go, not just the label on them.
  const canManage = session.profile.role === "admin" && !session.impersonating;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Sites & geofences"
        action={canManage ? <SiteForm /> : undefined}
      />

      <SitesWorkspace rows={rows} canManage={canManage} />

      <p className="text-xs text-muted-foreground">
        Boundaries are drawn on a map rather than typed. Tiles are served from
        this site&apos;s own origin and cached in the NBSS bucket, so the content
        policy needs no exception for a map CDN.
      </p>
    </div>
  );
}
