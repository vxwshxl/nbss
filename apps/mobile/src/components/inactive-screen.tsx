import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Phone, ShieldOff } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, BackHandler, Easing, Linking, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY, tel } from "@nbss/shared/company";

import { BrandLockup } from "@/components/brand-lockup";
import { GateScene } from "@/components/gate-scene";
import { Text } from "@/components/text";
import { useAuth } from "@/lib/auth";
import { color, gradient, radius, space } from "@/theme/tokens";

/**
 * "Account inactive", over everything, when an administrator has switched this
 * person's account off: at sign-in, or while the app was open. Laid out as the
 * update screen is, above the gate at night, so it reads as the app speaking, not
 * an error. The one way on is the office; "Back to sign in" lets someone else use
 * the phone.
 */
export function InactiveGate() {
  const { inactive, dismissInactive } = useAuth();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().height < 740;
  const [bandH, setBandH] = useState(0);

  useEffect(() => {
    if (!inactive) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [inactive]);

  if (!inactive) return null;

  return (
    <View style={[styles.overlay, { paddingTop: insets.top }]} accessibilityViewIsModal>
      <View style={styles.centre}>
        <Entrance>
          <View style={styles.column}>
            <View style={styles.lockup}>
              <BrandLockup size={compact ? "md" : "lg"} />
            </View>
            <Halo>
              <View style={styles.icon}>
                <ShieldOff size={30} color="#b45309" strokeWidth={1.9} />
              </View>
            </Halo>
            <View style={styles.badge}>
              <Text variant="caption" weight="semibold" style={{ color: "#92400e" }}>
                Account inactive
              </Text>
            </View>
            <Text weight="extrabold" style={styles.title}>
              This account is switched off
            </Text>
            <Text variant="label" tone="muted" style={styles.centred}>
              Your NBSS account is inactive, so the app is closed to it. Contact the NBSS administrator to switch it back on. Your duties and attendance are kept safe.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)}
              style={({ pressed }) => [styles.buttonWrap, pressed && styles.pressed]}
            >
              <LinearGradient colors={gradient.strong} start={gradient.start} end={gradient.end} style={styles.button}>
                <Phone size={16} color={color.primaryForeground} strokeWidth={2.2} />
                <Text weight="semibold" tone="inherit" style={[styles.button15, { color: color.primaryForeground }]}>
                  Call the office · {COMPANY.phone}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={dismissInactive} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <ArrowLeft size={16} color={color.foreground} strokeWidth={2.2} />
              <Text weight="semibold" style={styles.button15}>
                Back to sign in
              </Text>
            </Pressable>
          </View>
        </Entrance>
      </View>

      <View style={[styles.band, compact && styles.bandShort, { paddingBottom: insets.bottom }]} onLayout={(e) => setBandH(Math.round(e.nativeEvent.layout.height))}>
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
  return <Animated.View style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>{children}</Animated.View>;
}

/** A soft ring that breathes out from the icon. */
function Halo({ children }: { children: React.ReactNode }) {
  const r = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((still) => {
      if (still) return;
      loop = Animated.loop(Animated.timing(r, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
      loop.start();
    });
    return () => loop?.stop();
  }, [r]);
  return (
    <View style={styles.haloBox}>
      <Animated.View
        style={[
          styles.halo,
          { opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1001, elevation: 1001, backgroundColor: color.background },
  centre: { flex: 1, justifyContent: "center", paddingHorizontal: space[5] },
  column: { width: "100%", maxWidth: 400, alignSelf: "center", alignItems: "center", gap: space[3] },
  lockup: { alignItems: "center", marginBottom: space[2] },
  haloBox: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 76, height: 76, borderRadius: 38, backgroundColor: "#fbbf24" },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#fef3c7", borderWidth: 6, borderColor: "#fffbeb" },
  badge: { paddingHorizontal: space[3], paddingVertical: 4, borderRadius: 999, backgroundColor: "#fef3c7" },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -0.6, color: color.foreground, textAlign: "center" },
  centred: { textAlign: "center" },
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
  secondary: {
    alignSelf: "stretch",
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
  },
  button15: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.85 },
  band: { height: 200, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "#06110d" },
  bandShort: { height: 130 },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
