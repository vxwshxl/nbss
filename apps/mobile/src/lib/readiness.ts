import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import NbssAutostart from "../../modules/nbss-autostart";
import { Notifications } from "./push";
import { CAN_TRACK_IN_BACKGROUND } from "./runtime";

/**
 * Is this phone set up to keep tracking with the app closed?
 *
 * Four things decide it, and the app can check three of them: location set to
 * "Allow all the time", the battery saver not restricting the app, and
 * notifications allowed (the watchdog's wake push needs them). The fourth —
 * "Autostart" on Xiaomi, Vivo, Oppo, Realme and similar — has no API at all, so
 * on those brands the guard is shown where it is and confirms it once.
 */

const PACKAGE = "com.nbss.okhrang";
const AUTOSTART_KEY = "nbss.autostartConfirmed";
const FIRST_SEEN_KEY = "nbss.autostartFirstSeen";

const AUTOSTART_BRANDS = ["xiaomi", "redmi", "poco", "vivo", "iqoo", "oppo", "realme", "oneplus", "huawei", "honor", "asus", "tecno", "infinix", "itel", "lenovo", "letv", "meizu"];

export type Readiness = {
  location: "always" | "foreground" | "denied" | "off";
  /** True when Android may stop the app in the background to save battery. */
  batteryOptimized: boolean | null;
  notifications: boolean | null;
  /** Shown only on brands that have an Autostart switch. */
  autostart: "confirmed" | "needed" | "not_applicable";
  ready: boolean;
};

export function brandNeedsAutostart(): boolean {
  const brand = `${Device.brand ?? ""} ${Device.manufacturer ?? ""}`.toLowerCase();
  return Platform.OS === "android" && AUTOSTART_BRANDS.some((b) => brand.includes(b));
}

export async function checkReadiness(): Promise<Readiness | null> {
  if (!CAN_TRACK_IN_BACKGROUND) return null;
  const [services, fg, bg, optimized, notif, ack] = await Promise.all([
    Location.hasServicesEnabledAsync().catch(() => true),
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
    Platform.OS === "android" ? Battery.isBatteryOptimizationEnabledAsync().catch(() => null) : Promise.resolve(false),
    Notifications ? Notifications.getPermissionsAsync().then((p) => p.granted).catch(() => null) : Promise.resolve(null),
    autostartState(),
  ]);
  const location = !services ? "off" : bg?.granted ? "always" : fg?.granted ? "foreground" : "denied";
  const autostart = !brandNeedsAutostart() ? "not_applicable" : ack === "on" ? "confirmed" : "needed";
  return {
    location,
    batteryOptimized: optimized,
    notifications: notif,
    autostart,
    ready: location === "always" && optimized !== true && notif !== false && autostart !== "needed",
  };
}

/** Straight to "allow NBSS Kokrajhar to run in the background?", with fallbacks. */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== "android") return void Linking.openSettings();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, { data: `package:${PACKAGE}` });
    return;
  } catch {
    // Some phones refuse the direct request; the list of apps is the next best thing.
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
  } catch {
    void Linking.openSettings();
  }
}

/** The app's own settings page, where Autostart and battery live on most brands. */
export async function openAppSettings(): Promise<void> {
  if (Platform.OS !== "android") return void Linking.openSettings();
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${PACKAGE}` });
  } catch {
    void Linking.openSettings();
  }
}

export async function confirmAutostart(): Promise<void> {
  await AsyncStorage.setItem(AUTOSTART_KEY, new Date().toISOString()).catch(() => undefined);
}

/** The guard says Autostart is off after all (a reset, a new phone setting). */
export async function unconfirmAutostart(): Promise<void> {
  await AsyncStorage.removeItem(AUTOSTART_KEY).catch(() => undefined);
}

/** Whether the phone itself can show the Autostart switch to the app (Xiaomi, Redmi, POCO). */
export function autostartReadable(): boolean {
  return !!NbssAutostart && NbssAutostart.miuiAutostart() !== "unknown";
}

/** Opens this brand's own Autostart screen, or the app's settings where it has none. */
export async function openAutostartSettings(): Promise<void> {
  if (NbssAutostart?.openAutostartSettings()) return;
  if (!NbssAutostart) await openAppSettings();
}

/**
 * Is Autostart on? Read rather than asked wherever the phone allows it:
 *   1. Xiaomi, Redmi and POCO show the switch itself.
 *   2. Every brand shows it in effect: Android tells an app the phone has started only
 *      when the app may start by itself, so an app that heard the last restart is on,
 *      and one that was installed before the last restart and did not hear it is off.
 *   3. Until the phone has restarted once, the guard's own word, given after they
 *      opened the screen; the next restart then confirms it or takes it back.
 * "unknown" when there is nothing to go on yet.
 */
export async function autostartState(): Promise<"on" | "off" | "unknown"> {
  if (!brandNeedsAutostart()) return "unknown";
  // When the guard said it is on (epoch ms), or 0.
  const said = Date.parse((await AsyncStorage.getItem(AUTOSTART_KEY).catch(() => null)) ?? "") || 0;
  if (NbssAutostart) {
    const miui = NbssAutostart.miuiAutostart();
    if (miui !== "unknown") return miui;
    const { bootAt, seenAt } = NbssAutostart.bootState();
    if (seenAt && seenAt >= bootAt - 60_000) return "on";
    if (said > bootAt) return "on";
    let first = Number(await AsyncStorage.getItem(FIRST_SEEN_KEY).catch(() => null)) || 0;
    if (!first) {
      first = Date.now();
      await AsyncStorage.setItem(FIRST_SEEN_KEY, String(first)).catch(() => undefined);
    }
    if (first < bootAt) return "off";
  }
  return said ? "on" : "unknown";
}

/** Where Autostart lives, in the guard's words, for this phone's brand. */
export function autostartHint(): string {
  const b = `${Device.brand ?? ""} ${Device.manufacturer ?? ""}`.toLowerCase();
  if (b.includes("xiaomi") || b.includes("redmi") || b.includes("poco")) return "Settings → Apps → Manage apps → NBSS Kokrajhar → Autostart ON, and Battery saver → No restrictions.";
  if (b.includes("vivo") || b.includes("iqoo")) return "Settings → Battery → Background power consumption → NBSS Kokrajhar → Allow. Also i Manager → App manager → Autostart → ON.";
  if (b.includes("oppo") || b.includes("realme") || b.includes("oneplus")) return "Settings → Apps → NBSS Kokrajhar → Battery usage → Allow background activity and Allow auto launch.";
  if (b.includes("huawei") || b.includes("honor")) return "Settings → Apps → NBSS Kokrajhar → Battery → App launch → Manage manually, all three ON.";
  return "Open the app's settings and allow it to start on its own and run in the background.";
}
