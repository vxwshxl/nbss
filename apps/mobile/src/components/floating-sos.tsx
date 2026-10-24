import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { SOS_KIND_LABEL } from "@nbss/shared/sos";

import { Text } from "@/components/text";
import { useNow } from "@/hooks/use-now";
import { dutyAreas, raiseSos, type MapAlert } from "@/lib/duty";
import { Notifications } from "@/lib/push";
import { color, radius, shadow, space } from "@/theme/tokens";

const HOLD_MS = 3000;

/**
 * The panic button, on every guard screen: round, red, bottom-right, just above
 * the tab bar. Held for three seconds (a ring fills while held) it raises the SOS
 * and opens the map of who is coming; a quick tap only opens the SOS page, so a
 * phone in a pocket cannot raise one by brushing against it.
 */
export function FloatingSos({ bottom }: { bottom: number }) {
  const pathname = usePathname();
  const progress = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + progress.get() * 0.45 }], opacity: 0.35 * (1 - progress.get() * 0.4) }));
  const live = useLiveSos();

  // Hidden on an alert's own map, which is already about an SOS.
  if (pathname.startsWith("/sos")) return null;

  const fire = async () => {
    fired.current = true;
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    const r = await raiseSos();
    setBusy(false);
    progress.set(withTiming(0, { duration: 200 }));
    // Not sent (no internet, usually): the SOS page says why and offers a call and an SMS.
    // Either way the SOS tab: it shows the live SOS (map, who is coming), or why it failed.
    if (r.ok) router.navigate("/(guard)/alerts");
    else router.navigate({ pathname: "/(guard)/alerts", params: { failed: r.error } });
  };

  return (
    <>
    {live.length > 0 && pathname !== "/alerts" && <LiveSosBanner alerts={live} bottom={bottom + SIZE + 12} />}
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="SOS. Hold for three seconds to call for help"
        delayLongPress={HOLD_MS}
        onPressIn={() => {
          fired.current = false;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
          progress.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
        }}
        onPressOut={() => {
          if (fired.current) return;
          cancelAnimation(progress);
          progress.set(withTiming(0, { duration: 180 }));
        }}
        onLongPress={() => void fire()}
        onPress={() => router.push("/(guard)/alerts")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.center}>
            <Text variant="label" weight="bold" style={styles.label}>
              SOS
            </Text>
            <Text weight="semibold" style={styles.hint}>
              HOLD 3s
            </Text>
          </View>
        )}
      </Pressable>
    </View>
    </>
  );
}

/**
 * The open SOS this guard may see (their own, or one they were sent), kept fresh:
 * every 20 seconds, when the app comes back to the front, and the moment an SOS
 * push arrives.
 */
function useLiveSos(): MapAlert[] {
  const [alerts, setAlerts] = useState<MapAlert[]>([]);
  const load = useCallback(() => {
    void dutyAreas().then((d) => setAlerts(d.alerts));
  }, []);
  useEffect(() => {
    let live = true;
    void dutyAreas().then((d) => live && setAlerts(d.alerts));
    const t = setInterval(load, 20_000);
    const app = AppState.addEventListener("change", (s) => s === "active" && load());
    const push = Notifications?.addNotificationReceivedListener((n) => {
      const type = (n.request.content.data as { type?: string } | null)?.type;
      if (type === "sos") load();
    });
    return () => {
      live = false;
      clearInterval(t);
      app.remove();
      push?.remove();
    };
  }, [load]);
  return alerts;
}

/**
 * Above the SOS button while an alert is open: who, where, how long ago and how many
 * are coming. One tap opens the SOS tab, which shows it on the map. It stays until
 * the alert is resolved or stood down.
 */
function LiveSosBanner({ alerts, bottom }: { alerts: MapAlert[]; bottom: number }) {
  const now = useNow(30_000);
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })), -1));
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  const a = alerts[0]!;
  const many = alerts.length > 1;
  const mins = Math.max(0, Math.round((now - new Date(a.raised_at).getTime()) / 60_000));
  const title = many ? `${alerts.length} SOS open` : a.mine ? "Your SOS is live" : `${a.raiser_name.split(/\s+/)[0]} needs help`;
  const sub = many
    ? alerts.map((x) => x.site_name).join(", ")
    : `${a.site_name} · ${SOS_KIND_LABEL[a.kind]} · ${mins < 1 ? "just now" : `${mins} min ago`} · ${a.responders ? `${a.responders} coming` : "no answer yet"}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}. Open the SOS map.`}
      onPress={() => router.navigate("/(guard)/alerts")}
      style={({ pressed }) => [styles.banner, { bottom }, pressed && styles.pressed]}
    >
      <View style={styles.bannerDotRing}>
        <Animated.View style={[styles.bannerDot, dot]} />
      </View>
      <View style={styles.bannerText}>
        <Text variant="micro" weight="bold" tone="inherit" style={styles.bannerEyebrow}>
          LIVE SOS
        </Text>
        <Text variant="label" weight="bold" tone="inherit" style={styles.bannerTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="inherit" style={styles.bannerSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}

const SIZE = 64;
const styles = StyleSheet.create({
  wrap: { position: "absolute", right: 16, width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: color.sos },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: color.sos,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...shadow.raised,
  },
  pressed: { transform: [{ scale: 0.96 }] },
  banner: {
    position: "absolute",
    right: 12,
    left: 72,
    maxWidth: 340,
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[2.5],
    paddingLeft: space[3],
    paddingRight: space[2.5],
    borderRadius: radius.xl,
    backgroundColor: color.sos,
    borderWidth: 2,
    borderColor: "#fff",
    ...shadow.raised,
  },
  bannerDotRing: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#ffffff33", alignItems: "center", justifyContent: "center" },
  bannerDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff" },
  bannerText: { flex: 1, minWidth: 0 },
  bannerEyebrow: { color: "#ffffffcc", letterSpacing: 0.8 },
  bannerTitle: { color: "#fff" },
  bannerSub: { color: "#ffffffe6" },
  center: { alignItems: "center" },
  label: { color: "#fff", letterSpacing: 1, fontSize: 16, lineHeight: 18 },
  hint: { color: "#ffffffcc", fontSize: 8, lineHeight: 10, letterSpacing: 0.5 },
});
