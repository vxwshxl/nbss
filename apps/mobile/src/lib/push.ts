import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { APP_VERSION } from "./config";
import { supabase } from "./supabase";

/**
 * Push notifications, which exist here for one job: waking a closed app because a
 * colleague is in trouble.
 *
 * Everything else in this app is realtime over a WebSocket, which is faster and
 * cheaper — but a WebSocket only reaches a process that is running. At 3am the app
 * on every other guard's phone is closed, and a push is the only thing the OS will
 * act on. So this is not a nice-to-have channel; it is the SOS delivery path, and
 * the realtime broadcast is the optimisation on top of it.
 */

export const SOS_CHANNEL = "sos";

/**
 * How a notification behaves when it lands while the app is open.
 *
 * An SOS is shown and sounded even in the foreground, which is unusual — the normal
 * advice is to render it in-app instead. The reason is that the guard holding the
 * phone may be looking at a completely different screen, and a silent banner is
 * exactly what gets missed.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isSos = (notification.request.content.data as { type?: string } | null)?.type === "sos";
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: isSos,
      shouldSetBadge: false,
      // iOS: lifts it above a Focus mode. Paired with the time-sensitive entitlement
      // in app.config.ts and `interruptionLevel` on the sending side in 0006.
      priority: isSos
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

/**
 * The Android channel an SOS arrives on.
 *
 * Importance and the bypass flags are fixed when a channel is created and cannot be
 * changed afterwards — Android ignores an update to an existing channel's importance
 * on purpose, so the user stays in control of it. That means this has to be right the
 * first time a build reaches a device.
 */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(SOS_CHANNEL, {
    name: "SOS alerts",
    description:
      "A guard at your site has raised an emergency. These are deliberately loud and cannot be made quiet.",
    importance: Notifications.AndroidImportance.MAX,
    // Heads-up over whatever is on screen, and through Do Not Disturb.
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
    vibrationPattern: [0, 400, 200, 400, 200, 600],
    lightColor: "#C90019",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });

  // Everything that is not an emergency. Separated so a guard who mutes shift
  // reminders has not also muted the panic button.
  await Notifications.setNotificationChannelAsync("default", {
    name: "Shift and roster",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: "simulator" | "denied" | "no_project_id" | "error"; detail?: string };

/**
 * Registers this installation for push, and tells the database about it.
 *
 * Called on every launch rather than once. An Expo push token can be rotated by the
 * OS, and a phone handed to the next shift must re-point at whoever is signed in now
 * — which is why `register_device` in 0006 upserts on the token and takes the profile
 * from the JWT.
 */
export async function registerForPush(): Promise<PushRegistration> {
  // A simulator cannot receive a push, and asking produces a confusing failure rather
  // than a clear one.
  if (!Device.isDevice) return { ok: false, reason: "simulator" };

  await ensureChannels();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;

  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
        // Not `allowCriticalAlerts`: that needs an entitlement Apple grants case by
        // case, and time-sensitive delivery is enough to get through a Focus mode.
        allowProvisional: false,
      },
    });
    granted = asked.granted;
  }

  if (!granted) return { ok: false, reason: "denied" };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  // Without a projectId, Expo issues a token against the wrong project — or none —
  // and every SOS is delivered to nobody with no error anywhere. Reported loudly
  // rather than swallowed.
  if (!projectId) return { ok: false, reason: "no_project_id" };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc("register_device", {
      p_token: token,
      p_platform: Platform.OS === "ios" ? "ios" : "android",
      p_device_name: Device.deviceName ?? Device.modelName ?? undefined,
      p_app_version: APP_VERSION,
    });

    if (error) return { ok: false, reason: "error", detail: error.message };
    return { ok: true, token };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Hands the token back on sign-out.
 *
 * Not optional housekeeping: these phones are shared between shifts, and a token left
 * pointing at the outgoing guard means alerts for a site they have gone home from —
 * and, worse, the incoming guard's phone silently not being in the fan-out.
 */
export async function releasePush(): Promise<void> {
  if (!Device.isDevice) return;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.rpc("release_device", { p_token: token });
  } catch {
    // A sign-out must succeed whether or not this does.
  }
}

/** The shape 0006's `enqueue_sos_push` puts in `data`. */
export type SosPushData = {
  type: "sos";
  alert_id: string;
  site_id: string;
  site_name: string | null;
  raised_by: string;
  raiser: string | null;
  kind: string;
  lat: number | null;
  lng: number | null;
  raised_at: string;
  audience: string;
};

export function asSosPush(data: unknown): SosPushData | null {
  const d = data as SosPushData | null;
  return d && d.type === "sos" && typeof d.alert_id === "string" ? d : null;
}
