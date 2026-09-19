import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { distanceMetres } from "@nbss/shared/geo";
import { shouldSendPing, type Fix, type TrackingMode } from "@nbss/shared/location";

import { supabase } from "./supabase";

/**
 * The background location task.
 *
 * `defineTask` runs at module scope, not inside a component, and this file is
 * imported from src/app/_layout.tsx for exactly that reason. When Android or iOS
 * wakes the app to deliver a position, it starts the JavaScript runtime fresh with
 * no component tree at all — if the task were registered inside a `useEffect`, the
 * OS would hand a location to a task name it knows nothing about and log
 * "Task not found" while the map quietly went stale.
 *
 * ── Why the OS stream is denser than the write rate
 *
 * The adaptive policy in @nbss/shared/location says roughly "write on 50 m of
 * movement, or every two minutes". The obvious implementation is to ask the OS for
 * updates at exactly that rate. That does not work on Android, where
 * `timeInterval` has historically been ignored in favour of `distanceInterval`
 * alone — a guard standing still at a gate then produces no callbacks, no
 * heartbeat, and a dot that looks identical to a phone that has died.
 *
 * So the OS is asked for a moderately dense stream and `shouldSendPing` decides
 * what is worth a network round trip. An unwanted callback costs a few
 * microseconds; an unwanted insert costs a row, a realtime message and some
 * battery. Filtering in the cheap place is the whole trick.
 */

export const LOCATION_TASK = "nbss-location";

/** Where the last fix we actually sent is kept, so the distance rule has a baseline. */
const LAST_FIX_KEY = "nbss.lastFix";
const MODE_KEY = "nbss.trackingMode";

async function readLastFix(): Promise<Fix | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_FIX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Fix;
    return typeof parsed?.lat === "number" && typeof parsed?.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeLastFix(fix: Fix): Promise<void> {
  await AsyncStorage.setItem(LAST_FIX_KEY, JSON.stringify(fix)).catch(() => undefined);
}

export async function readMode(): Promise<TrackingMode> {
  const stored = await AsyncStorage.getItem(MODE_KEY).catch(() => null);
  return stored === "emergency" ? "emergency" : "on_duty";
}

async function writeMode(mode: TrackingMode): Promise<void> {
  await AsyncStorage.setItem(MODE_KEY, mode).catch(() => undefined);
}

export async function clearTrackingState(): Promise<void> {
  await AsyncStorage.multiRemove([LAST_FIX_KEY, MODE_KEY]).catch(() => undefined);
}

/**
 * Battery level, read per ping rather than watched.
 *
 * A subscription would mean holding state across a task that is torn down between
 * invocations, and the value is only there to tell "the guard stopped moving" apart
 * from "the phone died" — a reading that is a minute old answers that perfectly.
 */
async function batteryPercent(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level < 0 ? null : Math.round(level * 100);
  } catch {
    return null;
  }
}

type LocationTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Nothing useful to do from inside the task — it cannot show anything to
    // anybody. The console notices instead, because the heartbeat stops arriving.
    console.warn("[location] task error", error.message);
    return;
  }

  const locations = data?.locations ?? [];
  if (locations.length === 0) return;

  // The newest only. A batch arrives when the OS has been holding updates while the
  // device had no connectivity, and replaying a queue of stale positions would
  // write a trail that says the guard teleported.
  const newest = locations[locations.length - 1];
  if (!newest) return;

  const fix: Fix = {
    lat: newest.coords.latitude,
    lng: newest.coords.longitude,
    accuracyM: newest.coords.accuracy ?? Number.POSITIVE_INFINITY,
    at: Date.now(),
  };

  const [previous, mode] = await Promise.all([readLastFix(), readMode()]);

  const decision = shouldSendPing(fix, previous, mode, Date.now(), distanceMetres);
  if (!decision.send) return;

  const battery = await batteryPercent();

  const { data: result, error: rpcError } = await supabase.rpc("record_position", {
    p_lat: fix.lat,
    p_lng: fix.lng,
    p_accuracy_m: fix.accuracyM,
    p_heading: newest.coords.heading ?? undefined,
    p_speed_mps: newest.coords.speed ?? undefined,
    p_battery: battery ?? undefined,
    p_device_reported_at: new Date(newest.timestamp).toISOString(),
    p_ping_reason: decision.reason,
  });

  if (rpcError) {
    // Deliberately not recorded as sent. The next callback will try again, and the
    // distance rule still measures from the last position the server actually has —
    // so a spell without signal produces a gap rather than a wrong trail.
    console.warn("[location] record_position failed", rpcError.message);
    return;
  }

  const payload = (result ?? {}) as {
    tracked?: boolean;
    stored?: boolean;
    reason?: string;
    mode?: TrackingMode;
  };

  // The server refused to track: the guard has checked out, or the account is no
  // longer a guard. Stopping here rather than waiting for the app to notice is what
  // keeps the promise that tracking follows the shift — the phone stops reporting
  // even if nobody opens the app again.
  if (payload.tracked === false) {
    await stopTracking();
    return;
  }

  if (payload.stored) await writeLastFix(fix);

  /**
   * An SOS was raised at this site while we were away, and the server said so in the
   * reply to a ping we were making anyway — no push needed, no extra round trip.
   * The OS stream is restarted at the denser settings, because the interval is fixed
   * when updates start and cannot be changed in place.
   */
  if (payload.mode && payload.mode !== mode) {
    await writeMode(payload.mode);
    await restartTracking(payload.mode);
  }
});

/** Imported by ./location, which owns starting and stopping. Kept here to avoid a cycle. */
let restartTracking: (mode: TrackingMode) => Promise<void> = async () => undefined;
let stopTracking: () => Promise<void> = async () => undefined;

export function wireTaskControls(controls: {
  restart: (mode: TrackingMode) => Promise<void>;
  stop: () => Promise<void>;
}): void {
  restartTracking = controls.restart;
  stopTracking = controls.stop;
}

export { writeMode };
