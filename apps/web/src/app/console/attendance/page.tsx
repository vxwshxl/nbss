import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";

import {
  AttendanceWorkspace,
  type AttendanceRow,
} from "@/components/console/attendance-workspace";
import type { MapSite } from "@/components/console/site-map";
import { PageHeader } from "@/components/console/page-header";
import { Panel } from "@/components/ui/panel";
import { requireSession } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

/**
 * A polygon column is `Json`, so it has to be narrowed before it can be drawn.
 * Anything that is not a list of `[lng, lat]` pairs is treated as no polygon at
 * all rather than half-drawn — a fence rendered from malformed data is worse
 * than no fence, because it looks authoritative.
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

/**
 * One page for two audiences.
 *
 * A guard's row-level policy limits them to their own punches, so the same
 * query returns a personal history for them and the whole agency's for an
 * admin. No branch, and therefore no branch to get wrong — the only thing that
 * differs is the wording and whether the review controls are offered.
 */
export default async function AttendancePage() {
  const session = await requireSession();
  const supabase = await supabaseServer();

  const [attendance, sites] = await Promise.all([
    supabase
      .from("attendance")
      .select(
        "id, site_id, check_in_at, check_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m, check_in_method, check_out_distance_m, check_out_method, worked_minutes, overtime_minutes, status, device_reported_at, ip, review_note, reviewed_at, profiles(full_name, employee_code), sites(name)",
      )
      .order("check_in_at", { ascending: false })
      .limit(1000),
    // Fetched whole rather than joined onto each punch: the fence is needed to
    // draw the evidence map, and embedding a polygon on a thousand attendance
    // rows would ship the same handful of rings a thousand times over.
    supabase
      .from("sites")
      .select("id, name, client_name, district, lat, lng, geofence_radius_m, polygon"),
  ]);

  const fences = new Map<string, MapSite>(
    (sites.data ?? []).map((s) => [
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

  const mine = session.profile.role === "guard";

  const rows: AttendanceRow[] = (attendance.data ?? []).map((r) => {
    const guard = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
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
      // A guard sees only their own rows, so repeating their name on each is noise.
      guard_name: mine ? null : (guard?.full_name ?? null),
      guard_code: guard?.employee_code ?? null,
      site_name: place?.name ?? null,
      site: fences.get(r.site_id) ?? null,
    };
  });

  const canReview =
    (session.profile.role === "admin" || session.profile.role === "supervisor") &&
    // An admin viewing as someone else must not be able to sign off attendance
    // in that person's name — the audit line would be true and the record
    // misleading.
    !session.impersonating;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title={mine ? "My attendance" : "Attendance"}
      />

      <Panel
        tone="sky"
        title={mine ? "Every shift recorded for you" : "Every punch, across all sites"}
        icon={CalendarCheck}
        bodyClassName="p-3 sm:p-4"
      >
        <AttendanceWorkspace rows={rows} canReview={canReview} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Distance is how far from the site centre the guard stood when they punched.
        It is stored on every punch, so a dispute months later has evidence rather
        than an argument.
      </p>
    </div>
  );
}
