import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Text } from "@/components/text";
import { raiseSos } from "@/lib/duty";
import { color, shadow } from "@/theme/tokens";

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
    if (r.ok) router.push(`/sos/${r.alertId}`);
    else router.push({ pathname: "/(guard)/alerts", params: { failed: r.error } });
  };

  return (
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
  center: { alignItems: "center" },
  label: { color: "#fff", letterSpacing: 1, fontSize: 16, lineHeight: 18 },
  hint: { color: "#ffffffcc", fontSize: 8, lineHeight: 10, letterSpacing: 0.5 },
});
