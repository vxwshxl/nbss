import { StyleSheet, View } from "react-native";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

type Tone = "live" | "stale" | "offline" | "neutral" | "primary" | "danger";

const dotColor: Record<Tone, string> = {
  live: color.live,
  stale: color.stale,
  offline: color.offline,
  neutral: color.mutedForeground,
  primary: color.primary,
  danger: color.destructive,
};

/**
 * A small labelled dot. Used for freshness on the live map and for status anywhere.
 *
 * The label is never omitted in favour of just the dot. Colour alone fails for the
 * eight percent of men with a red-green deficiency, and this app is worn by a
 * workforce that is almost entirely men.
 */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: dotColor[tone] }]} />
      <Text weight="semibold" variant="micro" tone="muted" style={styles.label}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: color.muted,
    alignSelf: "flex-start",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { letterSpacing: 0.6 },
});
