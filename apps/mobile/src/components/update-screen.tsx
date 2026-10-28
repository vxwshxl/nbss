import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";
import { ArrowRight, Download, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLockup } from "@/components/brand-lockup";
import { GateScene } from "@/components/gate-scene";
import { Text } from "@/components/text";
import { useAppUpdate } from "@/lib/app-update";
import { APP_VERSION } from "@/lib/config";
import { color, gradient, radius, space } from "@/theme/tokens";

/**
 * "Update available", over everything, when the office has published a newer build
 * in the console (App updates). Laid out as the sign-in page is: the lockup, the
 * heading, the gradient button, the gate at night along the foot.
 *
 * Never over an SOS: an alarm on screen outranks an update, and the screen waits
 * until it is closed.
 */
export function UpdateGate() {
  const { release, later } = useAppUpdate();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().height < 740;
  const [bandH, setBandH] = useState(0);

  if (!release || pathname.startsWith("/sos")) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (compact ? space[3] : space[6]) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.lockup}>
            <BrandLockup size={compact ? "md" : "xl"} />
          </View>

          <View style={[styles.body, compact && styles.bodyTight]}>
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

            <Pressable accessibilityRole="button" onPress={later} hitSlop={8} style={styles.later}>
              <Text variant="label" weight="medium" tone="muted">
                Later
              </Text>
            </Pressable>

            <Text variant="caption" tone="muted" style={styles.centred}>
              You have {APP_VERSION}.
            </Text>
          </View>
        </View>

        <View style={[styles.band, compact && styles.bandShort]} onLayout={(e) => setBandH(Math.round(e.nativeEvent.layout.height))}>
          {bandH > 0 && <GateScene height={bandH} style={styles.cover} />}
        </View>
        <View style={{ height: insets.bottom }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000, backgroundColor: color.background },
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: { width: "100%", maxWidth: 400, alignSelf: "center", paddingHorizontal: space[5] },
  lockup: { alignItems: "center" },
  body: { marginTop: space[8], alignItems: "center", gap: space[3] },
  bodyTight: { marginTop: space[5] },
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
    marginTop: space[2],
    borderRadius: radius.xl,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  button: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
  button15: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.85 },
  later: { paddingVertical: space[2] },
  band: { flexGrow: 1, minHeight: 120, marginTop: space[6], borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", backgroundColor: "#06110d" },
  bandShort: { minHeight: 80 },
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
