import { withoutSpikes } from "@nbss/shared/geo";
import type { Row } from "@nbss/shared/db";
import { checkFence, toRing, type Fence } from "@nbss/shared/geo";
import type { SosKind, SosResponse } from "@nbss/shared/sos";
import type * as Location from "expo-location";

import { batteryState, deviceId } from "./device";
import { currentFix, restartTracking, startTracking, stopTracking } from "./location";
import { flush } from "./location-task";
import { CAN_TRACK_IN_BACKGROUND, IS_WEB } from "./runtime";
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
    .select(`site_id, starts_at, ends_at, sites!inner(${SITE_COLUMNS})`)
    .eq("sites.active", true)
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

export type Post = { siteId: string; siteName: string; startsAt: string; endsAt: string; shiftType: string | null; replacing: string | null };

/**
 * The guard's post: the rostered shift covering now, or the next one. Shown at
 * the top of the duty screen, and the site it names is offered first.
 */
export async function myPost(): Promise<Post | null> {
  const { data } = await supabase
    .from("shifts")
    .select("site_id, starts_at, ends_at, shift_type, notes, replaces_shift, sites!inner(name, active)")
    .eq("sites.active", true)
    .in("status", ["scheduled", "in_progress"])
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const site = (Array.isArray(data.sites) ? data.sites[0] : data.sites) as { name: string } | null;
  return {
    siteId: data.site_id,
    siteName: site?.name ?? "your site",
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    shiftType: data.shift_type,
    replacing: data.replaces_shift ? (data.notes?.replace(/^Replacing /, "") ?? null) : null,
  };
}

/**
 * Every active site.
 *
 * Offered after the guard's own post. A guard sent somewhere at short notice has no
 * roster entry for it, and refusing to show them the site would mean refusing to let
 * them work — the fence still decides the punch, and one off the roster is held for a
 * supervisor to approve.
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

/**
 * Whether the guard is where they are about to check in, read from one fresh fix
 * before anything is sent — so a guard at the wrong gate is told where to go
 * rather than refused by the server. The same maths the server then applies.
 */
export type Arrival =
  | { kind: "ready"; fix: Location.LocationObject; site: Site }
  | { kind: "nofix" }
  | { kind: "weak"; site: Site; accuracyM: number }
  | { kind: "elsewhere"; fix: Location.LocationObject; site: Site; here: Site }
  | { kind: "away"; site: Site; remainingM: number };

export async function checkArrival(target: Site, sites: Site[]): Promise<Arrival> {
  const fix = await currentFix();
  if (!fix) return { kind: "nofix" };
  const accuracyM = fix.coords.accuracy ?? Number.POSITIVE_INFINITY;
  if (accuracyM > target.max_accuracy_m) return { kind: "weak", site: target, accuracyM };

  const point = { lat: fix.coords.latitude, lng: fix.coords.longitude };
  const verdict = checkFence(toFence(target), point);
  if (verdict.inside) return { kind: "ready", fix, site: target };

  const here = sites.find((s) => s.id !== target.id && checkFence(toFence(s), point).inside);
  if (here) return { kind: "elsewhere", fix, site: target, here };
  return { kind: "away", site: target, remainingM: verdict.remainingM };
}

/** Turn-by-turn to the site in whatever maps app the phone has. */
export function directionsUrl(site: Pick<Site, "lat" | "lng">): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}&travelmode=walking`;
}

/** "4 min walk" — or a ride, past a couple of kilometres. */
export function eta(metres: number): { value: string; unit: string } {
  if (metres <= 0) return { value: "0", unit: "min · here" };
  if (metres < 2_000) return { value: String(Math.max(1, Math.round(metres / 80))), unit: "min walk" };
  return { value: String(Math.max(1, Math.round(metres / 400))), unit: "min ride" };
}

export type PunchResult =
  | {
      ok: true;
      message: string;
      distanceM: number;
      /**
       * Whether the background location stream actually started. False means the punch
       * was recorded but the control room will not see this guard move — which the duty
       * screen has to say out loud, because it is invisible from the phone otherwise.
       */
      tracking?: boolean;
    }
  | { ok: false; error: string };

/**
 * `position` is the fix the arrival check already took, so the guard does not
 * wait for a second one; without it a fresh fix is read here.
 */
export async function punchIn(siteId: string, fix?: Location.LocationObject | null): Promise<PunchResult> {
  const position = fix ?? (await currentFix());
  if (!position) {
    return {
      ok: false,
      error: "Your location could not be read. Switch GPS on, step into the open and try again.",
    };
  }

  const args = {
    p_site_id: siteId,
    p_lat: position.coords.latitude,
    p_lng: position.coords.longitude,
    p_accuracy_m: position.coords.accuracy ?? 9999,
    p_device_reported_at: new Date(position.timestamp).toISOString(),
    p_device_id: IS_WEB ? undefined : await deviceId(),
    p_battery: (await batteryState()).level ?? undefined,
  };
  const { data, error } = await withRetry(() => supabase.rpc("punch_in", args));

  // A second tap, or a retry after a reply that was lost on a weak network: the first
  // one landed. Nothing is overwritten (one open record at a time), so it is a success.
  if (error && /already checked in/i.test(error.message)) {
    if (!IS_WEB && CAN_TRACK_IN_BACKGROUND) await startTracking("on_duty").catch(() => undefined);
    return { ok: true, distanceM: 0, message: "You are checked in." };
  }
  // The function raises with a message written for a guard at a gate, so it is shown
  // rather than replaced.
  if (error) return { ok: false, error: error.message };

  const punch = (data ?? {}) as {
    site_name?: string;
    status?: string;
    distance_m?: number;
    mode?: "on_duty" | "emergency";
    device_flag?: string | null;
  };

  /**
   * Tracking starts only once the punch is recorded, and at the cadence the server
   * named — which may already be 'emergency' if a colleague raised an SOS while this
   * guard was walking to the gate.
   *
   * Deliberately not allowed to fail the check-in. By this line the punch is already
   * committed in Postgres: the guard IS on duty, their hours have started, and the
   * ledger says so. Letting an exception here surface as "check-in failed" would tell
   * them the opposite of the truth and send them to press the button again — which
   * `punch_in` would then refuse as a double check-in, leaving them convinced they are
   * off duty while payroll says otherwise.
   *
   * It throws for real reasons: Expo Go has no background location service on either
   * platform, and the background permission may have been declined. Both are reported
   * as a separate `tracking` flag that the duty screen renders as its own warning.
   */
  // The browser preview has no background location at all, so there is nothing to
  // start and nothing to warn about — guards carry the native app.
  // Where there is no background service (Expo Go) the screen's own fixes are the
  // only source, and the "Test build" notice on the duty screen already says so.
  let tracking: boolean | undefined = IS_WEB || !CAN_TRACK_IN_BACKGROUND ? undefined : true;
  if (!IS_WEB) {
    try {
      await startTracking(punch.mode ?? "on_duty");
    } catch (err) {
      tracking = false;
      console.warn("[duty] checked in, but tracking did not start:", err);
    }
  }

  return {
    ok: true,
    tracking,
    distanceM: punch.distance_m ?? 0,
    message:
      (punch.status === "late" ? `Checked in at ${punch.site_name}. Marked late.` : `Checked in at ${punch.site_name}.`) +
      (punch.device_flag === "shared_device"
        ? " This phone belongs to another guard, so your supervisor will check this attendance."
        : punch.device_flag === "new_device"
          ? " This phone is new for you, so your supervisor will approve it."
          : ""),
  };
}

export async function punchOut(handover?: string): Promise<PunchResult> {
  // Whatever was walked without signal goes in before the shift closes.
  await flush().catch(() => undefined);
  const position = await currentFix();
  if (!position) {
    return { ok: false, error: "Your location could not be read. Try again with GPS switched on." };
  }

  const outArgs = {
    p_lat: position.coords.latitude,
    p_lng: position.coords.longitude,
    p_accuracy_m: position.coords.accuracy ?? 9999,
    p_device_reported_at: new Date(position.timestamp).toISOString(),
    p_handover: handover?.trim() || undefined,
  };
  const { data, error } = await withRetry(() => supabase.rpc("punch_out", outArgs));

  // Already out (a double tap, or a retry whose first reply was lost): the shift is closed.
  if (error && /not checked in/i.test(error.message)) {
    await stopTracking().catch(() => undefined);
    return { ok: true, distanceM: 0, message: "You are checked out." };
  }
  if (error) return { ok: false, error: error.message };

  /**
   * Stopped after the server has accepted the check-out, not before: if the RPC had
   * failed, the guard is still on duty and must still be visible on the map.
   *
   * And not allowed to fail the check-out either. `punch_out` has already deleted the
   * guard_positions row and closed any open SOS, so the guard is off duty as far as
   * every other screen is concerned; a local stream that refuses to stop is a battery
   * problem, not a reason to tell them their shift did not end. The task stops itself
   * on its next ping regardless — `record_position` returns `not_on_duty` and the task
   * tears itself down.
   */
  try {
    await stopTracking();
  } catch (err) {
    console.warn("[duty] checked out, but tracking did not stop cleanly:", err);
  }

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
  | { ok: false; error: string; offline?: boolean; fix?: { lat: number; lng: number } | null };

/**
 * A position fast enough for an emergency: a fresh fix if one comes within three
 * seconds, else the last one the phone knows (minutes old is far better than
 * nothing), else none. The old path waited up to twelve seconds for GPS indoors.
 */
type Fix = { lat: number; lng: number; accuracyM: number; at: number };
let warm: Fix | null = null;

/**
 * Reads one position ahead of need, so a held SOS button has somewhere to say from the
 * first second. Called when a screen with the button opens and when the app returns to
 * the front: one reading each time, never a running watch, so it costs no battery.
 */
export async function prefetchFix(): Promise<void> {
  const pos = await currentFix().catch(() => null);
  if (pos) warm = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? 999, at: Date.now() };
}

async function quickFix(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  const Location = await import("expo-location");
  const fresh = await Promise.race([
    currentFix(),
    new Promise<null>((r) => setTimeout(() => r(null), 3_000)),
  ]);
  if (fresh) return { lat: fresh.coords.latitude, lng: fresh.coords.longitude, accuracyM: fresh.coords.accuracy ?? 999 };
  // The reading taken ahead of time, while it is still recent enough to be where they are.
  if (warm && Date.now() - warm.at < 15 * 60_000) return warm;
  const pos = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 }).catch(() => null);
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy ?? 999 } : null;
}

const looksOffline = (msg: string) => /network|fetch|timed? ?out|connection|offline|abort/i.test(msg);

/**
 * A punch on a weak network: tried again a few times while the failure looks like the
 * connection, not the database. Safe to repeat, because the database keeps one open
 * record per guard and refuses a second (which the callers above treat as done).
 */
async function withRetry<T extends { error: { message: string } | null }>(call: () => PromiseLike<T>): Promise<T> {
  let last!: T;
  for (const wait of [0, 1_500, 3_000, 5_000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = await call();
    if (!last.error || !looksOffline(last.error.message)) return last;
  }
  return last;
}

/**
 * Raising the alarm.
 *
 * The position is attached when there is one and the call is made regardless when
 * there is not. A guard indoors with no fix still needs help, and waiting for GPS
 * before telling anybody would be the wrong trade every single time. A dropped
 * connection is retried for about twelve seconds; after that the screen offers a
 * phone call and an SMS, which travel without mobile data.
 */
export async function raiseSos(kind: SosKind = "other", note?: string): Promise<RaiseResult> {
  const fix = await quickFix();

  let lastError = "";
  for (const wait of [0, 2_000, 4_000, 6_000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const { data, error } = await supabase.rpc("raise_sos", {
      p_kind: kind,
      p_lat: fix?.lat,
      p_lng: fix?.lng,
      p_accuracy_m: fix?.accuracyM,
      p_note: note,
    });

    if (!error) {
      const alert = (data ?? {}) as { alert_id?: string; notified?: number; repeat?: boolean };
      // Straight to the dense cadence. Wrapped because by now the alert is raised and
      // colleagues' phones are ringing — a cadence that could not change is not a failure.
      try {
        await restartTracking("emergency");
      } catch (err) {
        console.warn("[sos] raised, but could not switch to emergency tracking:", err);
      }
      return { ok: true, alertId: alert.alert_id ?? "", notified: alert.notified ?? 0, repeat: Boolean(alert.repeat) };
    }

    lastError = error.message;
    // Off duty and no location: the database cannot tell where help is needed.
    if (/no site could be found/i.test(error.message)) {
      return { ok: false, error: "your location could not be read. Turn location on and hold SOS again, or call the office", fix };
    }
    // A refusal from the database (inactive account) will not change on retry.
    if (!looksOffline(error.message)) return { ok: false, error: error.message, fix };
  }
  return { ok: false, error: lastError, offline: true, fix };
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

  // Back to the battery-friendly cadence now the emergency is over. Same reasoning: the
  // alert is closed in the database either way.
  try {
    await restartTracking("on_duty");
  } catch (err) {
    console.warn("[sos] closed, but could not restore normal tracking:", err);
  }
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

/* ───────────────────────────────────────────────────────── my duties ── */

export type MyDuty = {
  id: string;
  /** "off_roster": a check-in with no rostered duty behind it (history only). */
  kind?: "shift" | "off_roster";
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "in_progress" | "completed" | "missed" | "cancelled";
  shift_type: string | null;
  cancel_reason: string | null;
  notes?: string | null;
  site: Pick<Site, "id" | "name" | "address" | "district" | "lat" | "lng" | "geofence_radius_m" | "polygon" | "max_accuracy_m"> & { active?: boolean };
  /** Who took this duty over, when it was handed to someone else. */
  replaced_by: string | null;
  /** Whose duty this is, when this guard is covering it. */
  replacing: string | null;
  request: { id: string; status: "open" | "assigned" | "declined" | "withdrawn"; reason: string | null } | null;
  attendance: {
    id: string;
    check_in_at: string | null;
    check_out_at: string | null;
    /** Checked out by the system at the shift's end (0054), not by the guard. */
    auto_check_out?: boolean | null;
    worked_minutes: number | null;
    overtime_minutes?: number | null;
    status: string;
    device_flag?: string | null;
    review_note?: string | null;
  } | null;
  /** Every check-in of this duty, in order: a duty can be worked in more than one session. */
  sessions?: { id: string; check_in_at: string; check_out_at: string | null; worked_minutes: number | null; status: string; auto_check_out?: boolean | null }[];
};

/** The guard's duties from a week back to two weeks ahead, in order. */
export async function myDuties(): Promise<MyDuty[]> {
  const { data, error } = await supabase.rpc("my_duties", { p_days_back: 7, p_days_ahead: 14 });
  if (error) {
    console.warn("[duty] my_duties failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as MyDuty[];
}

/** Every duty and check-in between two IST dates (YYYY-MM-DD, inclusive): the history. */
export async function dutiesBetween(from: string, to: string): Promise<MyDuty[]> {
  const { data, error } = await supabase.rpc("my_duties_between", { p_from: from, p_to: to });
  if (error) {
    console.warn("[duty] my_duties_between failed", error.message);
    return [];
  }
  return (data ?? []) as unknown as MyDuty[];
}

/** One duty (or off-roster check-in) in full, for the detail screen. */
export async function myDuty(id: string): Promise<MyDuty | null> {
  const { data, error } = await supabase.rpc("my_duty", { p_id: id });
  if (error) console.warn("[duty] my_duty failed", error.message);
  return (data ?? null) as unknown as MyDuty | null;
}

/**
 * What happened to a duty, in the console register's words: a duty that ended with
 * no check-in is Absent; one handed to another guard is Replaced (not held against
 * this guard). The same rules as /console/reports/guard/[id], so the two agree.
 */
export type DutyOutcome = "present" | "late" | "absent" | "replaced" | "upcoming" | "not_arrived" | "pending_review" | "rejected" | "on_duty";

export const OUTCOME_LABEL: Record<DutyOutcome, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  replaced: "Replaced",
  upcoming: "Upcoming",
  not_arrived: "Not arrived",
  pending_review: "Needs review",
  rejected: "Rejected",
  on_duty: "On duty",
};

export function dutyOutcome(d: MyDuty, now: number): DutyOutcome {
  const a = d.attendance;
  if (d.replaced_by && !a?.check_in_at) return "replaced";
  if (a?.check_in_at) {
    if (!a.check_out_at) return "on_duty";
    return (["present", "late", "pending_review", "rejected"].includes(a.status) ? a.status : "present") as DutyOutcome;
  }
  if (new Date(d.ends_at).getTime() < now) return "absent";
  if (new Date(d.starts_at).getTime() <= now) return "not_arrived";
  return "upcoming";
}

export async function requestReplacement(shiftId: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("request_replacement", { p_shift_id: shiftId, p_reason: reason?.trim() || undefined });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function withdrawReplacement(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("withdraw_replacement_request", { p_request_id: requestId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type HandoverNote = { id: string; body: string; created_at: string; author: string | null };

/** The latest notes left at a site — what the last shift wants this one to know. */
export async function handoverNotes(siteId: string): Promise<HandoverNote[]> {
  const { data } = await supabase
    .from("handover_notes")
    .select("id, body, created_at, author_id")
    .eq("site_id", siteId)
    .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? []).map((n) => ({ id: n.id, body: n.body, created_at: n.created_at, author: null }));
}

export type RoutePoint = { lat: number; lng: number; at: number; inside: boolean | null };

/** One duty's route, check-in to check-out, with the time and fence verdict of each point. */
export async function myRoute(attendanceId: string): Promise<RoutePoint[]> {
  const { data } = await supabase.rpc("guard_trail", { p_attendance_id: attendanceId });
  const points = ((data as { points?: unknown[][] } | null)?.points ?? []) as [number, number, number, number, boolean | null][];
  // The phone's wild guesses out, as on the website (withoutSpikes).
  return withoutSpikes(
    points.map(([lat, lng, t, accuracy, inside]) => ({ lat: Number(lat), lng: Number(lng), at: Number(t) * 1000, accuracy: Number(accuracy), inside: inside ?? null })),
  ).map(({ accuracy: _accuracy, ...p }) => p);
}

/** The path walked since check-in, for the blue line on the duty map. */
export async function myTrail(attendanceId: string): Promise<{ lat: number; lng: number }[]> {
  const { data } = await supabase.rpc("guard_trail", { p_attendance_id: attendanceId });
  const points = ((data as { points?: unknown[][] } | null)?.points ?? []) as [number, number, number, number][];
  return withoutSpikes(points.map(([lat, lng, t, accuracy]) => ({ lat: Number(lat), lng: Number(lng), at: Number(t) * 1000, accuracy: Number(accuracy) }))).map(
    ({ lat, lng }) => ({ lat, lng }),
  );
}

/* ─────────────────────────────────────────── areas, colleagues and SOS on the map ── */

export type DutyArea = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geofence_radius_m: number;
  polygon: unknown;
  on_duty: number;
  rostered: number;
  /** The caller is rostered here today, or checked in here. */
  mine: boolean;
  sos: boolean;
};

export type Friend = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  site_id: string;
  site_name: string;
  check_in_at: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  battery: number | null;
  inside: boolean | null;
  heard_at: string | null;
};

export type MapAlert = {
  id: string;
  site_id: string;
  site_name: string;
  kind: SosKind;
  status: "active" | "acknowledged";
  raised_at: string;
  note: string | null;
  raised_by: string;
  raiser_name: string;
  raiser_phone: string | null;
  mine: boolean;
  lat: number | null;
  lng: number | null;
  responders: number;
};

export type DutyAreas = {
  areas: DutyArea[];
  friends: Friend[];
  alerts: MapAlert[];
  /** False when SOS is switched off for this person or their site (0052): no button. */
  sosAllowed: boolean;
};

/** Where duties are going on, who is on duty with this guard, and the open SOS they may see. */
export async function dutyAreas(): Promise<DutyAreas> {
  const [{ data, error }, sos] = await Promise.all([supabase.rpc("duty_areas_now"), supabase.rpc("my_sos_allowed")]);
  // Unknown is allowed: a button that is there when it should not be is refused by the
  // database; a button missing when it is needed cannot be undone.
  const sosAllowed = sos.error ? true : sos.data !== false;
  if (error) {
    console.warn("[duty] duty_areas_now failed", error.message);
    return { areas: [], friends: [], alerts: [], sosAllowed };
  }
  const d = (data ?? {}) as Partial<DutyAreas>;
  return { areas: d.areas ?? [], friends: d.friends ?? [], alerts: d.alerts ?? [], sosAllowed };
}
