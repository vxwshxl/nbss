
import { toRing } from "@nbss/shared/geo";
import type { LivePosition } from "@nbss/shared/realtime";

import { PageHeader } from "@/components/console/page-header";
import { LiveTracking, type DutyGuard, type NotArrived } from "@/components/tracking/live-tracking";
import type { LiveSite } from "@/components/tracking/live-map";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";


type Person = { full_name: string; employee_code: string; phone: string | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** The request's clock, read once. */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Where every guard on duty is right now, and where they have been since they
 * checked in. Tracking follows the punch: a guard appears here when they check
 * in from the app and disappears when they check out.
 */
/** `siteId`: one site's workspace shows only that site. */
export async function LiveView({ siteId }: { siteId?: string } = {}) {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();
  const now = nowIso();

  const [open, positions, sites, devices, sos, due] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, guard_id, site_id, check_in_at, status, device_flag, device_id, reviewed_at, silent_alerted_at, silent_staff_alerted_at, profiles!attendance_guard_id_fkey(full_name, employee_code, phone), sites(name, shift_start, shift_end), shifts!attendance_shift_id_fkey(starts_at, ends_at)")
      .is("check_out_at", null)
      .match(siteId ? { site_id: siteId } : {})
      .order("check_in_at"),
    supabase.from("guard_positions").select("*"),
    supabase.from("sites").select("id, name, lat, lng, geofence_radius_m, polygon").eq("active", true).match(siteId ? { id: siteId } : {}).order("name"),
    supabase
      .from("guard_devices")
      .select("id, profile_id, device_id, brand, model, platform, os_version, app_version, status, location_permission, gps_enabled, battery_optimized, notifications_enabled, precise_location, autostart, autostart_checked_at, permissions_at, last_seen_at")
      .order("last_seen_at", { ascending: false }),
    supabase.from("sos_alerts").select("raised_by").in("status", ["active", "acknowledged"]),
    supabase
      .from("shifts")
      .select("id, guard_id, site_id, starts_at, profiles!shifts_guard_id_fkey(full_name, employee_code, phone), sites(name, grace_minutes)")
      .eq("status", "scheduled")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .match(siteId ? { site_id: siteId } : {})
      .order("starts_at"),
  ]);

  const deviceRows = devices.data ?? [];
  const guards: DutyGuard[] = (open.data ?? []).map((a) => {
    const p = one(a.profiles as unknown as Person | null);
    const site = one(a.sites as unknown as { name: string; shift_start: string | null; shift_end: string | null } | null);
    const shift = one(a.shifts as unknown as { starts_at: string; ends_at: string } | null);
    // The phone this punch came from, else the guard's most recently seen one.
    const d =
      deviceRows.find((x) => x.profile_id === a.guard_id && x.device_id === a.device_id) ??
      deviceRows.find((x) => x.profile_id === a.guard_id) ??
      null;
    return {
      attendanceId: a.id,
      guardId: a.guard_id,
      name: p?.full_name ?? "A guard",
      code: p?.employee_code ?? "",
      phone: p?.phone ?? null,
      siteId: a.site_id,
      siteName: site?.name ?? "A site",
      checkInAt: a.check_in_at ?? now,
      // The rostered shift this punch answered, else the site's daily window.
      duty: shift
        ? { kind: "shift", start: shift.starts_at, end: shift.ends_at }
        : site?.shift_start && site.shift_end
          ? { kind: "site", start: site.shift_start, end: site.shift_end }
          : null,
      status: a.status,
      // Only while it is still held: a check-in a supervisor has accepted keeps its flag
      // on record but no longer needs anything doing.
      deviceFlag: a.reviewed_at ? null : a.device_flag,
      silentAlertedAt: a.silent_staff_alerted_at ?? a.silent_alerted_at,
      device: d
        ? {
            id: d.id,
            label: [d.brand, d.model].filter(Boolean).join(" ") || "Unknown phone",
            platform: d.platform,
            appVersion: d.app_version,
            permission: d.location_permission,
            gps: d.gps_enabled,
            batteryOptimized: d.battery_optimized,
            notifications: d.notifications_enabled,
            precise: d.precise_location,
            autostart: d.autostart,
            autostartCheckedAt: d.autostart_checked_at,
            checkedAt: d.permissions_at ?? d.last_seen_at,
            approved: d.status === "approved",
          }
        : null,
    };
  });

  const onDutyAt = new Map((open.data ?? []).map((a) => [a.site_id, true]));
  const liveSites: LiveSite[] = (sites.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    radiusM: s.geofence_radius_m,
    ring: (toRing(s.polygon) as [number, number][] | null) ?? null,
    staffed: onDutyAt.has(s.id),
  }));

  const checkedIn = new Set((open.data ?? []).map((a) => a.guard_id));
  const nowMs = new Date(now).getTime();
  const notArrived: NotArrived[] = (due.data ?? [])
    .filter((s) => !checkedIn.has(s.guard_id))
    .filter((s) => {
      const site = one(s.sites as unknown as { grace_minutes: number } | null);
      return new Date(s.starts_at).getTime() + (site?.grace_minutes ?? 10) * 60_000 < nowMs;
    })
    .map((s) => {
      const p = one(s.profiles as unknown as Person | null);
      return {
        shiftId: s.id,
        name: p?.full_name ?? "A guard",
        code: p?.employee_code ?? "",
        phone: p?.phone ?? null,
        siteId: s.site_id,
        siteName: one(s.sites as unknown as { name: string } | null)?.name ?? "a site",
        startsAt: s.starts_at,
      };
    });

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Location tracking" title="Live tracking" />
      <LiveTracking
        guards={guards}
        initialPositions={(positions.data ?? []) as unknown as LivePosition[]}
        sites={liveSites}
        sosGuards={(sos.data ?? []).map((s) => s.raised_by)}
        notArrived={notArrived}
      />
    </div>
  );
}
