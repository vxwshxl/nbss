import * as Battery from "expo-battery";
import * as Location from "expo-location";
import { BatteryCharging, Bell, ChevronRight, LocateFixed, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from "react-native";

import { Notifications } from "@/lib/push";
import { autostartHint, brandNeedsAutostart, confirmAutostart, openAppSettings, openBatterySettings } from "@/lib/readiness";
import { CAN_TRACK_IN_BACKGROUND, IS_WEB } from "@/lib/runtime";
import { TONES } from "@/theme/tones";
import { color, radius, space } from "@/theme/tokens";

import { Panel, PanelRow } from "./panel";
import { Text } from "./text";

type State = "ok" | "partial" | "missing" | "na";
type Perm = { key: string; icon: LucideIcon; title: string; detail: string; state: State; label: string; fix?: () => Promise<void> };

const settings = async () => void (await Linking.openSettings());

/** What each permission is for, what the phone says now, and the one thing that fixes it. */
async function read(location: boolean): Promise<Perm[]> {
  const out: Perm[] = [];
  if (location) {

  // Location: the one that matters.
  const [services, fg, bg] = await Promise.all([
    Location.hasServicesEnabledAsync().catch(() => true),
    Location.getForegroundPermissionsAsync().catch(() => null),
    CAN_TRACK_IN_BACKGROUND ? Location.getBackgroundPermissionsAsync().catch(() => null) : Promise.resolve(null),
  ]);
  const askLocation = async () => {
    const f = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (!f?.granted) {
      if (f && !f.canAskAgain) await settings();
      return;
    }
    if (!CAN_TRACK_IN_BACKGROUND) return;
    const b = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (b && !b.granted) await settings();
  };
  if (!services) {
    out.push({ key: "loc", icon: LocateFixed, title: "Location", detail: "Location is switched off on this phone. Turn it on in Settings.", state: "missing", label: "Off", fix: settings });
  } else if (!fg?.granted) {
    out.push({
      key: "loc",
      icon: LocateFixed,
      title: "Location",
      detail: "Needed to check in at your site and share where you are while on duty.",
      state: "missing",
      label: "Not allowed",
      fix: fg && !fg.canAskAgain ? settings : askLocation,
    });
  } else if (CAN_TRACK_IN_BACKGROUND && !bg?.granted) {
    out.push({
      key: "loc",
      icon: LocateFixed,
      title: "Location",
      detail: "Set to “Allow all the time” so tracking continues when the app is closed.",
      state: "partial",
      label: "While open",
      fix: bg && !bg.canAskAgain ? settings : askLocation,
    });
  } else {
    out.push({
      key: "loc",
      icon: LocateFixed,
      title: "Location",
      detail: CAN_TRACK_IN_BACKGROUND ? "Allowed all the time. Shared only while you are checked in." : "Allowed while the app is open (all this test app can use).",
      state: "ok",
      label: CAN_TRACK_IN_BACKGROUND ? "Always" : "Allowed",
    });
  }

  }

  // Notifications: SOS alarms and the tracking wake-up.
  if (!Notifications) {
    out.push({ key: "push", icon: Bell, title: "Notifications", detail: "This test app cannot receive alerts. The installed app can.", state: "na", label: "N/A" });
  } else {
    const p = await Notifications.getPermissionsAsync().catch(() => null);
    out.push({
      key: "push",
      icon: Bell,
      title: "Notifications",
      detail: p?.granted ? "SOS alarms from colleagues reach you, even on silent." : "Needed so an SOS from a colleague rings this phone.",
      state: p?.granted ? "ok" : "missing",
      label: p?.granted ? "Allowed" : "Not allowed",
      fix: p?.granted
        ? undefined
        : async () => {
            if (p && !p.canAskAgain) return settings();
            await Notifications!.requestPermissionsAsync().catch(() => null);
          },
    });
  }

  // Battery saver (Android): it stops tracking in the background.
  if (location && Platform.OS === "android") {
    const optimized = await Battery.isBatteryOptimizationEnabledAsync().catch(() => null);
    out.push({
      key: "battery",
      icon: BatteryCharging,
      title: "Battery",
      detail: optimized ? "The battery saver may stop tracking when the app is closed. Set it to “No restrictions”." : "Not restricted. Tracking can run in the background.",
      state: optimized ? "missing" : "ok",
      label: optimized ? "Restricted" : "Unrestricted",
      fix: optimized ? openBatterySettings : undefined,
    });
  }

  if (location && brandNeedsAutostart()) {
    out.push({
      key: "autostart",
      icon: RefreshCw,
      title: "Autostart",
      detail: autostartHint(),
      state: "partial",
      label: "Check",
      fix: async () => {
        await openAppSettings();
        await confirmAutostart();
      },
    });
  }
  return out;
}

const PILL: Record<State, { bg: string; fg: string }> = {
  ok: { bg: TONES.emerald.chip, fg: TONES.emerald.chipText },
  partial: { bg: TONES.amber.chip, fg: TONES.amber.chipText },
  missing: { bg: TONES.rose.chip, fg: TONES.rose.chipText },
  na: { bg: color.muted, fg: color.mutedForeground },
};

/**
 * Permissions, on the Me page: what this phone has allowed, in plain words. A row
 * that is not right yet is tappable and asks again — or, when the phone will not
 * show the question a second time, opens the app's page in Settings. Re-read when
 * the guard comes back from Settings.
 */
/** `location`: a guard's phone (location, battery, autostart); everyone needs notifications. */
export function PermissionsPanel({ location = true }: { location?: boolean }) {
  const [perms, setPerms] = useState<Perm[] | null>(null);

  const refresh = useCallback(() => {
    void read(location).then(setPerms);
  }, [location]);

  useEffect(() => {
    if (IS_WEB) return;
    let live = true;
    void read(location).then((p) => live && setPerms(p));
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => {
      live = false;
      sub.remove();
    };
  }, [refresh, location]);

  if (IS_WEB) return null;
  const missing = (perms ?? []).filter((p) => p.state === "missing" || p.state === "partial").length;

  return (
    <Panel
      tone={missing ? "amber" : "emerald"}
      title="Permissions"
      subtitle={perms ? (missing ? `${missing} to fix · tap to allow` : "Everything this app needs is allowed") : "Checking…"}
      icon={ShieldCheck}
      bare
    >
      {(perms ?? []).map((p, i) => {
        const Icon = p.icon;
        const pill = PILL[p.state];
        const body = (
          <PanelRow first={i === 0} style={styles.row}>
            <View style={[styles.chip, { backgroundColor: pill.bg }]}>
              <Icon size={18} color={pill.fg} strokeWidth={2} />
            </View>
            <View style={styles.text}>
              <Text variant="label" weight="semibold">
                {p.title}
              </Text>
              <Text variant="caption" tone="muted">
                {p.detail}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text variant="micro" weight="semibold" tone="inherit" style={{ color: pill.fg }}>
                {p.label}
              </Text>
            </View>
            {p.fix && <ChevronRight size={16} color={color.mutedForeground} strokeWidth={2} />}
          </PanelRow>
        );
        return p.fix ? (
          <Pressable
            key={p.key}
            accessibilityRole="button"
            accessibilityLabel={`${p.title}: ${p.label}. Tap to allow.`}
            onPress={() => void p.fix!().finally(refresh)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {body}
          </Pressable>
        ) : (
          <View key={p.key}>{body}</View>
        );
      })}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center" },
  chip: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  pill: { paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.full },
  pressed: { backgroundColor: color.muted },
});
