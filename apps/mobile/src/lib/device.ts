import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Device from "expo-device";
import * as Location from "expo-location";
import { Platform } from "react-native";

import { APP_VERSION } from "./config";
import { secureStorage } from "./secure-storage";
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
 * shows: make, model, system, app version, battery and whether location is set
 * to "all the time". Called on every launch and after sign-in. Never throws.
 */
export async function registerHandset(): Promise<HandsetStatus> {
  if (Platform.OS === "web") return null;
  try {
    const [id, battery, fg, bg, services] = await Promise.all([
      deviceId(),
      batteryState(),
      Location.getForegroundPermissionsAsync().catch(() => null),
      Location.getBackgroundPermissionsAsync().catch(() => null),
      Location.hasServicesEnabledAsync().catch(() => null),
    ]);
    const optimized = Platform.OS === "android" ? await Battery.isBatteryOptimizationEnabledAsync().catch(() => null) : null;
    const permission = bg?.granted ? "always" : fg?.granted ? "foreground" : fg ? "denied" : null;
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
