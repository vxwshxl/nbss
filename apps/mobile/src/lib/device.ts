import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { APP_VERSION } from "./config";
import { Notifications } from "./push";
import { brandNeedsAutostart, checkReadiness } from "./readiness";
import { secureStorage } from "./secure-storage";
import { CAN_TRACK_IN_BACKGROUND } from "./runtime";
import { supabase } from "./supabase";

/**
 * Which phone this is.
 *
 * The agency's rule is that a guard checks in from their own phone, so that
 * nobody marks a friend present from somewhere else. The database decides what
 * that means (0022 → register_handset, device_flag_for); this file only says,
 * truthfully, which phone is asking.
 *
 * The id is the platform's own per-app install id where there is one — Android's
 * ANDROID_ID survives a reinstall of the app, which is exactly the case of a
 * guard reinstalling to "start fresh" on a borrowed phone — and a random id kept
 * in the keychain otherwise.
 */

const KEY = "nbss.deviceId";
let cached: string | null = null;

function random(): string {
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)];
  return s;
}

export async function deviceId(): Promise<string> {
  if (cached) return cached;
  let id: string | null = null;
  try {
    if (Platform.OS === "android") id = Application.getAndroidId();
    else if (Platform.OS === "ios") id = await Application.getIosIdForVendorAsync();
  } catch {
    id = null;
  }
  if (id) id = `${Platform.OS}-${id}`;
  if (!id) {
    id = (await secureStorage.getItem(KEY).catch(() => null)) ?? null;
    if (!id) {
      id = `${Platform.OS}-${random()}`;
      await secureStorage.setItem(KEY, id).catch(() => undefined);
    }
  }
  cached = id;
  // Readable from the background task without the keychain round trip.
  await AsyncStorage.setItem(KEY, id).catch(() => undefined);
  return id;
}

/** The id without any work, for the background task; null until the app has run once. */
export async function cachedDeviceId(): Promise<string | null> {
  return cached ?? (await AsyncStorage.getItem(KEY).catch(() => null));
}

export async function batteryState(): Promise<{ level: number | null; charging: boolean | null }> {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return {
      level: level < 0 ? null : Math.round(level * 100),
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch {
    return { level: null, charging: null };
  }
}

export type HandsetStatus = { status: "approved" | "pending" | "blocked"; sharedWith: string | null } | null;

/**
 * Tells the database which phone this is, with what the console's Devices page
 * and guard card show: make, model, system, app version, battery, and what the
 * phone has allowed the app (location level and precision, notifications, the
 * battery saver, Autostart). Called on every launch, after sign-in and whenever
 * the app comes back to the front. Never throws.
 */
export async function registerHandset(): Promise<HandsetStatus> {
  if (Platform.OS === "web") return null;
  try {
    const [id, battery, fg, bg, services] = await Promise.all([
      deviceId(),
      batteryState(),
      Location.getForegroundPermissionsAsync().catch(() => null),
      CAN_TRACK_IN_BACKGROUND ? Location.getBackgroundPermissionsAsync().catch(() => null) : Promise.resolve(null),
      Location.hasServicesEnabledAsync().catch(() => null),
    ]);
    const [optimized, notifications, readiness] = await Promise.all([
      Platform.OS === "android" ? Battery.isBatteryOptimizationEnabledAsync().catch(() => null) : Promise.resolve(null),
      Notifications ? Notifications.getPermissionsAsync().then((p) => p.granted).catch(() => null) : Promise.resolve(null),
      brandNeedsAutostart() ? checkReadiness().catch(() => null) : Promise.resolve(null),
    ]);
    const permission = bg?.granted ? "always" : fg?.granted ? "foreground" : fg ? "denied" : null;
    // "Approximate" location on Android 12+ and iOS 14+ puts a guard anywhere within a few km.
    const accuracy = Platform.OS === "android" ? fg?.android?.accuracy : fg?.ios?.accuracy;
    const precise = !fg?.granted || !accuracy ? null : accuracy === "fine" || accuracy === "full";
    const autostart = Platform.OS !== "android" ? null : brandNeedsAutostart() ? (readiness?.autostart ?? null) : "not_applicable";
    const { data, error } = await supabase.rpc("register_handset", {
      p_device_id: id,
      p_platform: Platform.OS,
      p_brand: Device.brand ?? Device.manufacturer ?? undefined,
      p_model: Device.modelName ?? undefined,
      p_os_version: Device.osVersion ?? undefined,
      p_app_version: APP_VERSION,
      p_device_name: Device.deviceName ?? undefined,
      p_battery: battery.level ?? undefined,
      p_charging: battery.charging ?? undefined,
      p_location_permission: permission ?? undefined,
      p_gps_enabled: services ?? undefined,
      p_battery_optimized: optimized ?? undefined,
      p_notifications: notifications ?? undefined,
      p_precise_location: precise ?? undefined,
      p_autostart: autostart ?? undefined,
    });
    if (error) {
      console.warn("[device] register_handset failed", error.message);
      return null;
    }
    const r = (data ?? {}) as { status?: string; shared_with?: string | null };
    return { status: (r.status as "approved" | "pending" | "blocked") ?? "pending", sharedWith: r.shared_with ?? null };
  } catch (err) {
    console.warn("[device] could not register", err);
    return null;
  }
}
