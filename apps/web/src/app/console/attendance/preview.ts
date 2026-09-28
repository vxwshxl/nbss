"use server";

import type { MapSite } from "@/components/console/site-map";
import { requireSession } from "@/lib/auth";
import { toRing } from "@/lib/fence";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * One punch, everything about it — loaded when its popup opens.
 *
 * Read on the viewer's own client, so row level security still decides: a
 * guard can open their own punches and nobody else's, staff can open any.
 */
export type AttendanceDetail = {
  id: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_accuracy_m: number | null;
  check_in_distance_m: number | null;
  check_in_method: string;
  check_out_distance_m: number | null;
  check_out_method: string | null;
  worked_minutes: number | null;
  overtime_minutes: number | null;
  device_reported_at: string | null;
  ip: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  /** Checked in at a site the guard was not rostered to. */
  off_roster: boolean;
  /** Minutes since check-in while the punch is still open. */
  onDutyMinutes: number | null;
  guard: { id: string; name: string; code: string; phone: string | null; email: string | null } | null;
  site: (MapSite & { address: string | null; clientId: string | null }) | null;
};

export async function attendanceDetail(id: string): Promise<AttendanceDetail | { error: string }> {
  await requireSession();
  const supabase = await supabaseServer();

  const { data: r } = await supabase
    .from("attendance")
    .select(
      "id, status, off_roster, check_in_at, check_out_at, check_in_lat, check_in_lng, check_in_accuracy_m, check_in_distance_m, check_in_method, check_out_distance_m, check_out_method, worked_minutes, overtime_minutes, device_reported_at, ip, review_note, reviewed_at, profiles!attendance_guard_id_fkey(id, full_name, employee_code, phone, email), sites(id, name, client_name, client_id, district, address, lat, lng, geofence_radius_m, polygon)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!r) return { error: "That punch could not be found." };

  const g = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
    | { id: string; full_name: string; employee_code: string; phone: string | null; email: string | null }
    | null;
  const s = (Array.isArray(r.sites) ? r.sites[0] : r.sites) as unknown as {
    id: string;
    name: string;
    client_name: string | null;
    client_id: string | null;
    district: string | null;
    address: string | null;
    lat: number;
    lng: number;
    geofence_radius_m: number;
    polygon: Parameters<typeof toRing>[0];
  } | null;

  return {
    id: r.id,
    status: r.status,
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
    device_reported_at: r.device_reported_at,
    ip: r.ip as string | null,
    review_note: r.review_note,
    reviewed_at: r.reviewed_at,
    off_roster: r.off_roster,
    onDutyMinutes:
      r.check_in_at && !r.check_out_at
        ? Math.max(0, Math.round((Date.now() - new Date(r.check_in_at).getTime()) / 60_000))
        : null,
    guard: g ? { id: g.id, name: g.full_name, code: g.employee_code, phone: g.phone, email: g.email } : null,
    site: s
      ? {
          id: s.id,
          name: s.name,
          client_name: s.client_name,
          clientId: s.client_id,
          district: s.district,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          geofence_radius_m: s.geofence_radius_m,
          ring: toRing(s.polygon),
          onDuty: 0,
          assigned: 0,
        }
      : null,
  };
}
