import type { Metadata } from "next";

import { toRing } from "@nbss/shared/geo";
import type { LivePosition } from "@nbss/shared/realtime";

import { PageHeader } from "@/components/console/page-header";
import { LiveTracking, type DutyGuard, type NotArrived } from "@/components/tracking/live-tracking";
import type { LiveSite } from "@/components/tracking/live-map";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live tracking" };
export const dynamic = "force-dynamic";

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
export default async function LivePage() {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();
  const now = nowIso();

  const [open, positions, sites, devices, sos, due] = await Promise.all([
    supabase
      .from("attendance")
      .select("id, guard_id, site_id, check_in_at, status, device_flag, device_id, silent_alerted_at, silent_staff_alerted_at, profiles!attendance_guard_id_fkey(full_name, employee_code, phone), sites(name)")
      .is("check_out_at", null)
      .order("check_in_at"),
    supabase.from("guard_positions").select("*"),
    supabase.from("sites").select("id, name, lat, lng, geofence_radius_m, polygon").eq("active", true).order("name"),
    supabase
      .from("guard_devices")
      .select("profile_id, device_id, brand, model, platform, os_version, app_version, status, location_permission, gps_enabled, battery_optimized, last_seen_at")
      .order("last_seen_at", { ascending: false }),
    supabase.from("sos_alerts").select("raised_by").in("status", ["active", "acknowledged"]),
    supabase
      .from("shifts")
      .select("id, guard_id, starts_at, profiles!shifts_guard_id_fkey(full_name, employee_code, phone), sites(name, grace_minutes)")
      .eq("status", "scheduled")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("starts_at"),
  ]);

  const deviceRows = devices.data ?? [];
  const guards: DutyGuard[] = (open.data ?? []).map((a) => {
    const p = one(a.profiles as unknown as Person | null);
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
      siteName: one(a.sites as unknown as { name: string } | null)?.name ?? "A site",
      checkInAt: a.check_in_at ?? now,
      status: a.status,
      deviceFlag: a.device_flag,
      silentAlertedAt: a.silent_staff_alerted_at ?? a.silent_alerted_at,
      device: d
        ? {
            label: [d.brand, d.model].filter(Boolean).join(" ") || "Unknown phone",
            platform: d.platform,
            appVersion: d.app_version,
            permission: d.location_permission,
            gps: d.gps_enabled,
            batteryOptimized: d.battery_optimized,
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
