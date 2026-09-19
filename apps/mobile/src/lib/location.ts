import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import { policyFor, type TrackingMode } from "@nbss/shared/location";

import { LOCATION_TASK, clearTrackingState, readMode, wireTaskControls, writeMode } from "./location-task";

/**
 * Permissions and the lifecycle of the background stream.
 *
 * The permission dance is the part that actually decides whether this product works,
 * and it is not a single prompt. On Android 11 and later, "Allow all the time" cannot
 * be requested from a dialog at all — the OS shows only "While using the app", and
 * background access has to be turned on by the person in Settings. An app that asks
 * once and gives up looks broken to the guard and produces a map full of gaps for the
 * supervisor. So `requestTracking` reports precisely which of the two is missing, and
 * `openSettings` is what the duty screen offers when the second one is.
 */

export type PermissionState =
  | { ok: true }
  | { ok: false; need: "foreground"; canAsk: boolean }
  | { ok: false; need: "background"; canAsk: boolean }
  | { ok: false; need: "services" };

/** Asks for what is missing, in the order the OS requires it to be asked. */
export async function requestTracking(): Promise<PermissionState> {
  // Location switched off device-wide beats any permission. Worth distinguishing,
  // because "grant permission" is useless advice to someone with GPS turned off.
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, need: "services" };

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { ok: false, need: "foreground", canAsk: foreground.canAskAgain };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    // On Android this returns `canAskAgain: false` immediately on 11+, because there
    // is no dialog to ask with. The screen reads that as "send them to Settings".
    return { ok: false, need: "background", canAsk: background.canAskAgain };
  }

  return { ok: true };
}

/** Reads the current state without prompting — for a screen deciding what to show. */
export async function checkTracking(): Promise<PermissionState> {
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, need: "services" };

  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return { ok: false, need: "foreground", canAsk: foreground.canAskAgain };

  const background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) return { ok: false, need: "background", canAsk: background.canAskAgain };

  return { ok: true };
}

export function openSettings(): void {
  // iOS has a URL for the app's own settings page; on Android this opens app
  // details, from which Permissions → Location → Allow all the time is two taps.
  void Linking.openSettings();
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
}

/**
 * Starts the stream.
 *
 * The intervals asked of the OS are deliberately tighter than the rate at which
 * positions are written — see the comment in location-task.ts. `distanceInterval` is
 * half the policy's threshold so that a guard who crosses it is noticed promptly
 * rather than on the next timed callback.
 */
export async function startTracking(mode: TrackingMode = "on_duty"): Promise<void> {
  const policy = policyFor(mode);
  await writeMode(mode);

  if (await isTracking()) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy:
      policy.desiredAccuracy === "best"
        ? Location.Accuracy.BestForNavigation
        : policy.desiredAccuracy === "high"
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,

    distanceInterval: Math.max(5, Math.round(policy.minDistanceM / 2)),
    timeInterval: Math.max(5_000, Math.round(policy.heartbeatMs / 4)),

    /**
     * The Android foreground service. Without it the OS kills the task within
     * minutes of the screen going off, which is most of a night shift.
     *
     * The notification is not an annoyance to be minimised — it is the honest
     * disclosure that this is happening, and it is what a guard can point at to show
     * they were tracked. So it says plainly what it is doing.
     */
    foregroundService: {
      notificationTitle: "On duty — location shared",
      notificationBody:
        "The control room can see you are on site. This stops when you check out.",
      notificationColor: "#00925b",
      // The service is not torn down when the activity is destroyed, which is what
      // "swiped the app away but is still on shift" looks like.
      killServiceOnDestroy: false,
    },

    // iOS. Without this the OS pauses updates when it decides the user has stopped
    // moving — which for a guard standing at a gate is precisely the wrong call.
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
    showsBackgroundLocationIndicator: true,

    // Deferred updates are a battery optimisation that batches positions and delivers
    // them late. An emergency cannot afford it; normal duty can, a little.
    deferredUpdatesInterval: mode === "emergency" ? 0 : 30_000,
    deferredUpdatesDistance: mode === "emergency" ? 0 : 20,
  });
}

export async function stopTracking(): Promise<void> {
  if (await isTracking()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
  }
  await clearTrackingState();
}

/**
 * Switching cadence.
 *
 * The interval is fixed when updates start and cannot be changed in place, so the
 * stream is stopped and started again. The last-fix baseline is deliberately kept —
 * only the mode changes, and forgetting where the guard was would produce one
 * spurious 'first' ping.
 */
export async function restartTracking(mode: TrackingMode): Promise<void> {
  await writeMode(mode);
  if (await isTracking()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => undefined);
  }
  await startTracking(mode);
}

// Closes the loop with the task, which has to be able to stop and restart itself
// when the server tells it the shift has ended or an SOS has begun, without this
// module importing it and creating a cycle.
wireTaskControls({ restart: restartTracking, stop: stopTracking });

export { readMode };

/** One-off fix, for the check-in screen — which needs a position now, not on a stream. */
export async function currentFix(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      // A cached position is fine if it is seconds old; a punch must not be allowed
      // on a fix from the last site the guard stood at.
      ...(Platform.OS === "android" ? {} : {}),
    });
  } catch {
    return null;
  }
}
