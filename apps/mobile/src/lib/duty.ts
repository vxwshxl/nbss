import type { Row } from "@nbss/shared/db";
import { checkFence, toRing, type Fence } from "@nbss/shared/geo";
import type { SosKind, SosResponse } from "@nbss/shared/sos";

import { currentFix, restartTracking, startTracking, stopTracking } from "./location";
import { supabase } from "./supabase";

/**
 * Everything the duty screen does.
 *
 * Each of these is one RPC. Nothing here decides whether a punch is allowed, how far
 * a guard is from a gate, or whether a shift was late — `punch_in` and `punch_out` in
 * 0008 do all of that in Postgres, from coordinates it stored and a clock it owns.
 * The only local computation is `nearbySites`, which colours a button before the
 * round trip and is explicitly not authoritative.
 */

export type Site = Pick<
  Row<"sites">,
  | "id"
  | "name"
  | "client_name"
  | "district"
  | "address"
  | "lat"
  | "lng"
  | "geofence_radius_m"
  | "max_accuracy_m"
  | "shift_start"
  | "shift_end"
  | "polygon"
>;

const SITE_COLUMNS =
  "id, name, client_name, district, address, lat, lng, geofence_radius_m, max_accuracy_m, shift_start, shift_end, polygon";

export type OpenPunch = {
  id: string;
  site_id: string;
  site_name: string | null;
  check_in_at: string | null;
  status: string;
};

/** The guard's currently open punch, if they are on duty. */
export async function openPunch(): Promise<OpenPunch | null> {
  const { data } = await supabase
    .from("attendance")
    .select("id, site_id, check_in_at, status, sites(name)")
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const site = Array.isArray(data.sites) ? data.sites[0] : data.sites;
  return {
    id: data.id,
    site_id: data.site_id,
    site_name: site?.name ?? null,
    check_in_at: data.check_in_at,
    status: data.status,
  };
}

/** The sites this guard is rostered to around now — what the check-in picker offers. */
export async function rosteredSites(): Promise<Site[]> {
  const { data } = await supabase
    .from("shifts")
    .select(`site_id, starts_at, ends_at, sites(${SITE_COLUMNS})`)
    .neq("status", "cancelled")
    .gte("ends_at", new Date(Date.now() - 4 * 3_600_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 8 * 3_600_000).toISOString())
    .order("starts_at");

  const sites = new Map<string, Site>();
  for (const row of data ?? []) {
    const site = (Array.isArray(row.sites) ? row.sites[0] : row.sites) as Site | null;
    if (site) sites.set(site.id, site);
  }
  return [...sites.values()];
}

/**
 * Every active site, as a fallback.
 *
 * A guard sent somewhere at short notice has no roster entry for it, and refusing to
 * show them the site would mean refusing to let them work. The fence still decides
 * whether the punch is allowed, so offering the whole list costs nothing.
 */
export async function allSites(): Promise<Site[]> {
  const { data } = await supabase.from("sites").select(SITE_COLUMNS).eq("active", true).order("name");
  return (data ?? []) as Site[];
}

export function toFence(site: Site): Fence {
  return {
    lat: site.lat,
    lng: site.lng,
    geofence_radius_m: site.geofence_radius_m,
    ring: toRing(site.polygon),
  };
}

export type SiteProximity = {
  site: Site;
  inside: boolean;
  distanceM: number;
};

/**
 * How far the phone is from each site, computed locally.
 *
 * Purely so the screen can say "23 m away — you can check in" before anybody presses
 * anything. `checkFence` mirrors `site_fence_check` exactly for this reason, and the
 * verdict is thrown away the moment the server gives its own.
 */
export async function nearbySites(sites: Site[]): Promise<{
  fix: { lat: number; lng: number; accuracyM: number } | null;
  proximity: SiteProximity[];
}> {
  const position = await currentFix();
  if (!position) return { fix: null, proximity: [] };

  const point = { lat: position.coords.latitude, lng: position.coords.longitude };

  const proximity = sites
    .map((site) => {
      const verdict = checkFence(toFence(site), point);
      return { site, inside: verdict.inside, distanceM: verdict.distanceM };
    })
    .sort((a, b) => Number(b.inside) - Number(a.inside) || a.distanceM - b.distanceM);

  return {
    fix: { ...point, accuracyM: position.coords.accuracy ?? Number.POSITIVE_INFINITY },
    proximity,
  };
}

export type PunchResult =
  | { ok: true; message: string; distanceM: number }
  | { ok: false; error: string };

export async function punchIn(siteId: string): Promise<PunchResult> {
  const position = await currentFix();
  if (!position) {
    return {
      ok: false,
      error: "Your location could not be read. Switch GPS on, step into the open and try again.",
    };
  }

  const { data, error } = await supabase.rpc("punch_in", {
    p_site_id: siteId,
    p_lat: position.coords.latitude,
    p_lng: position.coords.longitude,
    p_accuracy_m: position.coords.accuracy ?? 9999,
    p_device_reported_at: new Date(position.timestamp).toISOString(),
  });

  // The function raises with a message written for a guard at a gate, so it is shown
  // rather than replaced.
  if (error) return { ok: false, error: error.message };

  const punch = (data ?? {}) as {
    site_name?: string;
    status?: string;
    distance_m?: number;
    mode?: "on_duty" | "emergency";
  };

  /**
   * Tracking starts only once the punch is recorded, and at the cadence the server
   * named — which may already be 'emergency' if a colleague raised an SOS while this
   * guard was walking to the gate.
   */
  await startTracking(punch.mode ?? "on_duty");

  return {
    ok: true,
    distanceM: punch.distance_m ?? 0,
    message:
      punch.status === "late"
        ? `Checked in at ${punch.site_name}. Marked late.`
        : `Checked in at ${punch.site_name}.`,
  };
}

export async function punchOut(): Promise<PunchResult> {
  const position = await currentFix();
  if (!position) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const { data, error } = await supabase.rpc("punch_out", {
    p_lat: position.coords.latitude,
    p_lng: position.coords.longitude,
    p_accuracy_m: position.coords.accuracy ?? 9999,
    p_device_reported_at: new Date(position.timestamp).toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  // Stopped after the server has accepted the check-out, not before. If the RPC had
  // failed, the guard is still on duty and must still be visible on the map.
  await stopTracking();

  const punch = (data ?? {}) as {
    site_name?: string;
    worked_minutes?: number;
    overtime_minutes?: number;
    distance_m?: number;
  };
  const worked = punch.worked_minutes ?? 0;

  return {
    ok: true,
    distanceM: punch.distance_m ?? 0,
    message: `Checked out of ${punch.site_name ?? "your site"}. ${Math.floor(worked / 60)}h ${String(
      worked % 60,
    ).padStart(2, "0")}m recorded${
      punch.overtime_minutes ? `, including ${punch.overtime_minutes} min overtime` : ""
    }.`,
  };
}

/* ────────────────────────────────────────────────────────────────── SOS ── */

export type RaiseResult =
  | { ok: true; alertId: string; notified: number; repeat: boolean }
  | { ok: false; error: string };

/**
 * Raising the alarm.
 *
 * The position is attached when there is one and the call is made regardless when
 * there is not. A guard indoors with no fix still needs help, and waiting for GPS
 * before telling anybody would be the wrong trade every single time.
 */
export async function raiseSos(kind: SosKind = "other", note?: string): Promise<RaiseResult> {
  const position = await currentFix();

  const { data, error } = await supabase.rpc("raise_sos", {
    p_kind: kind,
    p_lat: position?.coords.latitude,
    p_lng: position?.coords.longitude,
    p_accuracy_m: position?.coords.accuracy ?? undefined,
    p_note: note,
  });

  if (error) return { ok: false, error: error.message };

  const alert = (data ?? {}) as { alert_id?: string; notified?: number; repeat?: boolean };

  // Straight to the dense cadence, without waiting to be told by the next ping.
  await restartTracking("emergency");

  return {
    ok: true,
    alertId: alert.alert_id ?? "",
    notified: alert.notified ?? 0,
    repeat: Boolean(alert.repeat),
  };
}

export async function acknowledgeSos(
  alertId: string,
  response: SosResponse = "responding",
): Promise<{ ok: boolean; error?: string }> {
  const position = await currentFix();

  const { error } = await supabase.rpc("acknowledge_sos", {
    p_alert_id: alertId,
    p_response: response,
    p_lat: position?.coords.latitude,
    p_lng: position?.coords.longitude,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function closeSos(
  alertId: string,
  status: "resolved" | "false_alarm",
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("close_sos", {
    p_alert_id: alertId,
    p_status: status,
    p_note: note,
  });

  if (error) return { ok: false, error: error.message };

  // Back to the battery-friendly cadence now the emergency is over.
  await restartTracking("on_duty");
  return { ok: true };
}

export type LiveAlert = Row<"sos_alerts"> & { raiser_name?: string | null; site_name?: string | null };

/** Any alert still ringing that this account was told about. */
export async function liveAlerts(): Promise<LiveAlert[]> {
  const { data } = await supabase
    .from("sos_alerts")
    .select("*, profiles!sos_alerts_raised_by_fkey(full_name), sites(name)")
    .in("status", ["active", "acknowledged"])
    .order("raised_at", { ascending: false });

  return (data ?? []).map((row) => {
    const { profiles, sites, ...alert } = row as typeof row & {
      profiles?: { full_name: string } | { full_name: string }[] | null;
      sites?: { name: string } | { name: string }[] | null;
    };
    const raiser = Array.isArray(profiles) ? profiles[0] : profiles;
    const site = Array.isArray(sites) ? sites[0] : sites;
    return { ...alert, raiser_name: raiser?.full_name ?? null, site_name: site?.name ?? null } as LiveAlert;
  });
}
