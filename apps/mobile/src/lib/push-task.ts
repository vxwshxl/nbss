import * as TaskManager from "expo-task-manager";

import { ensureTracking } from "./keep-alive";
import { Notifications } from "./push";

/**
 * Runs JavaScript when a push arrives while the app is in the background or
 * closed. Defined at module scope and imported from the root layout, like the
 * location task, because the OS starts the app with no component tree to deliver
 * it.
 *
 * Its one job is the watchdog's wake: a data-only, high-priority message that
 * Android lets an app use to restart its location service from the background.
 */
export const PUSH_TASK = "nbss-push";

/** The `type` field, wherever this platform put the data (object, or a JSON string). */
export function pushType(raw: unknown, depth = 0): string | null {
  if (!raw || depth > 4) return null;
  if (typeof raw === "string") {
    try {
      return pushType(JSON.parse(raw), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type === "string") return o.type;
  for (const key of ["data", "dataString", "body", "notification", "request", "content", "trigger", "remoteMessage"]) {
    const found = pushType(o[key], depth + 1);
    if (found) return found;
  }
  return null;
}

TaskManager.defineTask(PUSH_TASK, async ({ data, error }) => {
  if (error) return;
  const type = pushType(data);
  if (type === "resume_tracking" || type === "sos") await ensureTracking();
});

if (Notifications) {
  void Notifications.registerTaskAsync(PUSH_TASK).catch((err: unknown) => console.warn("[push] background task not registered", err));
}
