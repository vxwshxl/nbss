import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { distanceMetres } from "@nbss/shared/geo";
import { shouldSendPing, type Fix, type TrackingMode } from "@nbss/shared/location";

import { batteryState, cachedDeviceId } from "./device";
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
 * The adaptive policy in @nbss/shared/location says roughly "write on 20 m of
 * movement, or every minute". The obvious implementation is to ask the OS for
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

/**
 * Forgets the cadence and the baseline. The outbox is kept on purpose: points
 * walked before a check-out still belong to that shift and are sent first.
 */
export async function clearTrackingState(): Promise<void> {
  await AsyncStorage.multiRemove([LAST_FIX_KEY, MODE_KEY]).catch(() => undefined);
}

/**
 * The outbox: positions accepted by the policy but not yet confirmed by the
 * server. A guard walking through a dead zone keeps adding to it; the next
 * successful send carries all of it, with each point's own time, so the route
 * history shows the real path rather than a straight line across the gap.
 * Capped, oldest first out, so a phone offline all night cannot grow it forever.
 */
const QUEUE_KEY = "nbss.positionQueue";
const QUEUE_MAX = 1500;
const BATCH_MAX = 200;
const STRIKES_KEY = "nbss.positionQueueStrikes";
/** When the server last took something from this phone (a position or a heading). */
const LAST_SYNC_KEY = "nbss.lastSyncAt";

async function markSynced(): Promise<void> {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now())).catch(() => undefined);
}

/** For the duty screen's "Last synced": when, and how many points are still waiting. */
export async function syncStatus(): Promise<{ lastSyncAt: number | null; queued: number }> {
  const [at, queue] = await Promise.all([AsyncStorage.getItem(LAST_SYNC_KEY).catch(() => null), readQueue()]);
  return { lastSyncAt: at ? Number(at) : null, queued: queue.length };
}

type QueuedPoint = {
  lat: number;
  lng: number;
  accuracy_m: number;
  heading?: number;
  speed_mps?: number;
  battery?: number;
  charging?: boolean;
  at: number;
};

async function readQueue(): Promise<QueuedPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const q = raw ? (JSON.parse(raw) as QueuedPoint[]) : [];
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: QueuedPoint[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX))).catch(() => undefined);
}

/** How many points are waiting for a signal — shown on the duty screen. */
export async function queuedCount(): Promise<number> {
  return (await readQueue()).length;
}

let flushing: Promise<void> | null = null;

/**
 * Feeds positions in — from the background task, or from the screen while it is
 * open (the only source in Expo Go, which has no background location). Both go
 * through the same policy and the same outbox, so they never double-count.
 */
export async function feedLocations(locations: { lat: number; lng: number; accuracyM: number; heading?: number | null; speed?: number | null; at: number }[]): Promise<void> {
  if (locations.length === 0) return;
  const [mode, battery] = await Promise.all([readMode(), batteryState()]);
  let previous = await readLastFix();
  const accepted: QueuedPoint[] = [];

  for (const l of [...locations].sort((a, b) => a.at - b.at)) {
    const fix: Fix = { lat: l.lat, lng: l.lng, accuracyM: l.accuracyM, at: l.at };
    if (previous && fix.at <= previous.at) continue;
    const decision = shouldSendPing(fix, previous, mode, fix.at, distanceMetres);
    if (!decision.send) continue;
    accepted.push({
      lat: fix.lat,
      lng: fix.lng,
      accuracy_m: Math.round(fix.accuracyM * 10) / 10,
      heading: l.heading != null && l.heading >= 0 ? l.heading : undefined,
      speed_mps: l.speed != null && l.speed >= 0 ? l.speed : undefined,
      battery: battery.level ?? undefined,
      charging: battery.charging ?? undefined,
      at: fix.at,
    });
    previous = fix;
  }

  if (accepted.length > 0) {
    await writeLastFix(previous!);
    await writeQueue([...(await readQueue()), ...accepted]);
  }
  await flush();
}

let headingSent = { deg: -999, at: 0 };

/**
 * The compass alone, while the duty screen is open. Standing still sends no points,
 * so without this the console's arrow froze while the guard turned on the spot. Only
 * a turn of 15° or more goes out, and at most every 4 seconds.
 */
export function sendHeading(deg: number | null): void {
  if (deg == null || deg < 0) return;
  const now = Date.now();
  const turned = Math.abs(((deg - headingSent.deg + 540) % 360) - 180);
  if (turned < 15 || now - headingSent.at < 4000) return;
  headingSent = { deg, at: now };
  void supabase.rpc("record_heading", { p_heading: Math.round(deg) }).then(({ error }) => {
    if (error) headingSent = { deg: -999, at: now };
    else void markSynced();
  });
}

/** Sends what is waiting. One at a time: a second caller waits for the first. */
export async function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      for (let round = 0; round < 10; round++) {
        const queue = await readQueue();
        if (queue.length === 0) return;
        const batch = queue.slice(0, BATCH_MAX);
        const { data, error } = await supabase.rpc("record_positions", {
          p_points: batch,
          p_device_id: (await cachedDeviceId()) ?? undefined,
        });
        if (error) {
          // No signal, or the token is mid-refresh: kept for the next try. A refusal
          // that is not about the network (a batch the server cannot take) is given
          // three chances and then dropped, so one bad batch can never block every
          // position after it.
          const network = /network|fetch|timed? ?out|connection|abort|jwt|token/i.test(error.message);
          const strikes = network ? 0 : Number((await AsyncStorage.getItem(STRIKES_KEY).catch(() => null)) ?? 0) + 1;
          if (strikes >= 3) {
            console.warn("[location] dropping a batch the server refused three times:", error.message);
            await writeQueue((await readQueue()).slice(batch.length));
            await AsyncStorage.removeItem(STRIKES_KEY).catch(() => undefined);
            continue;
          }
          await AsyncStorage.setItem(STRIKES_KEY, String(strikes)).catch(() => undefined);
          console.warn("[location] record_positions failed, kept", queue.length, error.message);
          return;
        }
        await AsyncStorage.removeItem(STRIKES_KEY).catch(() => undefined);
        await markSynced();
        // Only what was sent is removed: points added while the request was out stay.
        const latest = await readQueue();
        await writeQueue(latest.slice(batch.length));

        const payload = (data ?? {}) as { tracked?: boolean; mode?: TrackingMode };
        if (payload.tracked === false) {
          // Checked out (from another phone, or by a supervisor): stop, and drop
          // anything queued — the server will not take positions for a closed shift.
          await writeQueue([]);
          await stopTracking();
          return;
        }
        const mode = await readMode();
        if (payload.mode && payload.mode !== mode) {
          await writeMode(payload.mode);
          await restartTracking(payload.mode);
        }
        if (latest.length <= batch.length) return;
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

type LocationTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Nothing useful to do from inside the task — it cannot show anything to
    // anybody. The console notices instead, because the heartbeat stops arriving.
    console.warn("[location] task error", error.message);
    return;
  }

  // Every location, not only the newest: when the OS has been holding updates
  // (screen off, no signal) each one is a real place the guard was, at a real time,
  // and the route history is only as good as what is kept here.
  const locations = (data?.locations ?? []).map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    accuracyM: l.coords.accuracy ?? Number.POSITIVE_INFINITY,
    heading: l.coords.heading,
    speed: l.coords.speed,
    at: l.timestamp,
  }));
  await feedLocations(locations);
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
