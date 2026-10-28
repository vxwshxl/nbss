import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";
import { ArrowRight, Download, Sparkles } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Linking, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLockup } from "@/components/brand-lockup";
import { GateScene } from "@/components/gate-scene";
import { Text } from "@/components/text";
import { useAppUpdate } from "@/lib/app-update";
import { color, gradient, radius, space } from "@/theme/tokens";

/**
 * "Update available", over everything, when the office has published a newer build
 * in the console (App updates). There is no way past it but the store: an older build
 * is not used once a newer one is out. The block sits in the middle of the white space
 * above the gate at night, and rises in when it appears.
 *
 * Never over an SOS: an alarm on screen outranks an update, and the screen waits
 * until it is closed.
 */
export function UpdateGate() {
  const release = useAppUpdate();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().height < 740;
  const [bandH, setBandH] = useState(0);
  const shown = !!release && !pathname.startsWith("/sos");

  // Android's back button does not dismiss it either.
  useEffect(() => {
    if (!shown) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [shown]);

  if (!shown) return null;

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} accessibilityViewIsModal>
      <View style={styles.centre}>
        <Entrance>
          <View style={styles.column}>
            <View style={styles.lockup}>
              <BrandLockup size={compact ? "md" : "lg"} />
            </View>
            <View style={styles.badge}>
              <Sparkles size={14} color={color.primary} strokeWidth={2.2} />
              <Text variant="caption" weight="semibold" style={{ color: color.primary }}>
                {release.version_name ? `Version ${release.version_name}` : "New version"}
              </Text>
            </View>
            <Text weight="extrabold" style={styles.title}>
              Update available
            </Text>
            <Text variant="label" tone="muted" style={styles.centred}>
              A newer NBSS app is ready on the Play Store. Update to keep checking in, tracking and SOS working as they should.
            </Text>

            {release.notes ? (
              <View style={styles.notes}>
                <Text variant="caption" weight="semibold" tone="muted" style={styles.notesHead}>
                  WHAT&apos;S NEW
                </Text>
                <Text variant="label">{release.notes}</Text>
              </View>
            ) : null}

            <Pulse>
              <Pressable
                accessibilityRole="button"
                onPress={() => void Linking.openURL(release.store_url!)}
                style={({ pressed }) => [styles.buttonWrap, pressed && styles.pressed]}
              >
                <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={styles.button}>
                  <Download size={16} color={color.primaryForeground} strokeWidth={2.2} />
                  <Text weight="semibold" tone="inherit" style={[styles.button15, { color: color.primaryForeground }]}>
                    Update now
                  </Text>
                  <ArrowRight size={16} color={color.primaryForeground} strokeWidth={2.2} />
                </LinearGradient>
              </Pressable>
            </Pulse>
          </View>
        </Entrance>
      </View>

      <View
        style={[styles.band, compact && styles.bandShort, { paddingBottom: insets.bottom }]}
        onLayout={(e) => setBandH(Math.round(e.nativeEvent.layout.height))}
      >
        {bandH > 0 && <GateScene height={bandH} style={styles.cover} />}
      </View>
    </View>
  );
}

/** Fades and rises in once; still for anyone who has asked for reduced motion. */
function Entrance({ children }: { children: React.ReactNode }) {
  const t = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((still) => {
      if (still) t.setValue(1);
      else Animated.timing(t, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }, [t]);
  return (
    <Animated.View style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** A slow breath on the one button there is, so the eye goes to it. */
function Pulse({ children }: { children: React.ReactNode }) {
  const s = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((still) => {
      if (still) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.delay(900),
          Animated.timing(s, { toValue: 1.035, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(s, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [s]);
  return <Animated.View style={{ alignSelf: "stretch", transform: [{ scale: s }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000, backgroundColor: color.background },
  // The white space above the gate; the block sits in its middle.
  centre: { flex: 1, justifyContent: "center", paddingHorizontal: space[5] },
  column: { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center", gap: space[3] },
  lockup: { alignItems: "center", marginBottom: space[3] },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  // As the sign-in's "Login".
  title: { fontSize: 32, lineHeight: 40, letterSpacing: -0.8, color: color.foreground, textAlign: "center" },
  centred: { textAlign: "center" },
  notes: {
    alignSelf: "stretch",
    gap: 4,
    marginTop: space[1],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.muted,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  notesHead: { letterSpacing: 1 },
  buttonWrap: {
    alignSelf: "stretch",
    marginTop: space[3],
    borderRadius: radius.xl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  button: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
  button15: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.85 },
  band: { height: 200, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "#06110d" },
  bandShort: { height: 130 },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
