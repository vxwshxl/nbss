import { openPunch } from "./duty";
import { applyPendingRestart, checkTracking, isTracking, readMode, startTracking, stopTracking } from "./location";
import { flush } from "./location-task";
import { CAN_TRACK_IN_BACKGROUND } from "./runtime";

/**
 * Makes the phone's tracking match the shift, whatever happened in between.
 *
 * Called whenever there is a chance to: the app opening, coming back to the
 * front, and a wake push from the server's watchdog (0023 → check_silent_guards).
 * A guard who swiped the app away on a phone whose battery saver then killed the
 * location service, or whose phone restarted mid-shift, is tracked again the
 * moment any of those happens — without having to press anything.
 *
 * Never throws: it runs from places that cannot show an error to anybody.
 */
export type KeepAlive = "tracking" | "started" | "off_duty" | "no_permission" | "unsupported" | "failed";

export async function ensureTracking(): Promise<KeepAlive> {
  if (!CAN_TRACK_IN_BACKGROUND) return "unsupported";
  try {
    const punch = await openPunch();
    if (!punch) {
      // Checked out (perhaps by a supervisor, or on the website): nothing should run.
      if (await isTracking()) await stopTracking();
      return "off_duty";
    }
    if (await isTracking()) {
      await applyPendingRestart();
      await flush();
      return "tracking";
    }
    const permission = await checkTracking();
    if (!permission.ok && permission.need !== "background") return "no_permission";
    await startTracking(await readMode());
    await flush();
    return "started";
  } catch (err) {
    console.warn("[keep-alive] could not restore tracking", err);
    return "failed";
  }
}
