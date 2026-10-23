import { BatteryCharging, Bell, CheckCircle2, MapPin, Power, ShieldAlert } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";

import { Panel } from "@/components/panel";
import { Text } from "@/components/text";
import { registerHandset } from "@/lib/device";
import { openSettings, requestTracking } from "@/lib/location";
import { registerForPush } from "@/lib/push";
import {
  autostartHint,
  checkReadiness,
  confirmAutostart,
  openAppSettings,
  openBatterySettings,
  type Readiness,
} from "@/lib/readiness";
import { color, radius, space } from "@/theme/tokens";

/**
 * "Will this phone keep tracking with the app closed?" — as a short list of
 * switches, each with the one tap that fixes it. Shown on the duty screen only
 * while something is missing, and re-checked each time the guard comes back
 * from Settings, so it disappears by itself once the phone is ready.
 */
export function PhoneSetup({ onDuty }: { onDuty: boolean }) {
  const [state, setState] = useState<Readiness | null>(null);

  const refresh = useCallback(async () => {
    const r = await checkReadiness();
    setState(r);
    // The console's Devices page shows the same switches.
    void registerHandset();
  }, []);

  useEffect(() => {
    let gone = false;
    const load = () => {
      void checkReadiness().then((r) => !gone && setState(r));
      void registerHandset();
    };
    load();
    const sub = AppState.addEventListener("change", (s) => s === "active" && load());
    return () => {
      gone = true;
      sub.remove();
    };
  }, []);

  if (!state || state.ready) return null;

  const rows: { key: string; ok: boolean; icon: typeof MapPin; title: string; hint: string; fix: () => void; fixLabel: string }[] = [
    {
      key: "location",
      ok: state.location === "always",
      icon: MapPin,
      title: "Location: Allow all the time",
      hint: state.location === "off" ? "Location is switched off on this phone." : "Without it, sharing stops when the app is closed.",
      fixLabel: state.location === "denied" ? "Allow" : "Open settings",
      fix: () => {
        if (state.location === "denied") void requestTracking().then(refresh);
        else openSettings();
      },
    },
    {
      key: "battery",
      ok: state.batteryOptimized !== true,
      icon: BatteryCharging,
      title: "Battery: Unrestricted",
      hint: "Otherwise the phone stops NBSS Kokrajhar in the background to save battery.",
      fixLabel: "Allow",
      fix: () => void openBatterySettings(),
    },
    {
      key: "notifications",
      ok: state.notifications !== false,
      icon: Bell,
      title: "Notifications on",
      hint: "For SOS from colleagues, new duties, and to restart sharing if it stops.",
      fixLabel: "Allow",
      fix: () => void registerForPush().then(refresh),
    },
  ];
  if (state.autostart !== "not_applicable") {
    rows.push({
      key: "autostart",
      ok: state.autostart === "confirmed",
      icon: Power,
      title: "Autostart ON",
      hint: autostartHint(),
      fixLabel: "Open settings",
      fix: () => void openAppSettings().then(() => confirmAutostart()),
    });
  }

  const missing = rows.filter((r) => !r.ok).length;

  return (
    <Panel
      tone={onDuty ? "rose" : "amber"}
      title={onDuty ? "Sharing may stop if you close the app" : "Set up this phone before your duty"}
      subtitle={`${missing} ${missing === 1 ? "setting needs" : "settings need"} a tap. It stays fixed after that.`}
      icon={ShieldAlert}
    >
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          {r.ok ? <CheckCircle2 size={20} color={color.primary} strokeWidth={2.2} /> : <r.icon size={20} color={color.destructive} strokeWidth={2.2} />}
          <View style={styles.flex}>
            <Text variant="label" weight="semibold">
              {r.title}
            </Text>
            {!r.ok && (
              <Text variant="caption" tone="muted">
                {r.hint}
              </Text>
            )}
          </View>
          {!r.ok && (
            <Pressable accessibilityRole="button" onPress={r.fix} style={({ pressed }) => [styles.fix, pressed && styles.pressed]}>
              <Text variant="caption" weight="semibold" tone="inverse">
                {r.fixLabel}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
      {state.autostart === "needed" && (
        <Pressable onPress={() => void confirmAutostart().then(refresh)}>
          <Text variant="caption" weight="semibold" tone="primary">
            I have turned Autostart on
          </Text>
        </Pressable>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[2] },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  fix: { backgroundColor: color.primary, borderRadius: radius.full, paddingHorizontal: space[3], paddingVertical: space[2] },
  pressed: { opacity: 0.8 },
});
