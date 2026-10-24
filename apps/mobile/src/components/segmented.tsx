import { Pressable, StyleSheet, View } from "react-native";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The console's filter chips ("All · Inside · Outside"): a row of pills, the chosen one
 * in ink. Used for a two- or three-way switch at the top of a screen.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  stretch,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  /** Share the width equally instead of sizing to the labels. */
  stretch?: boolean;
}) {
  return (
    <View style={[styles.row, stretch && styles.track]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.chip, stretch && styles.grow, on ? styles.on : stretch ? styles.offTrack : styles.off, pressed && !on && styles.pressed]}
          >
            <Text variant="label" weight="semibold" tone="inherit" style={{ color: on ? color.primaryForeground : color.foreground }}>
              {o.label}
              {o.count != null ? <Text variant="label" tone="inherit" style={{ color: on ? "#ffffffb3" : color.mutedForeground }}>{`  ${o.count}`}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  track: { flexWrap: "nowrap", padding: 4, borderRadius: radius.full, backgroundColor: color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.lineSoft },
  chip: { minHeight: 36, paddingHorizontal: space[4], borderRadius: radius.full, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  grow: { flex: 1 },
  on: { backgroundColor: color.foreground, borderColor: color.foreground },
  off: { backgroundColor: color.card, borderColor: color.border },
  offTrack: { backgroundColor: "transparent", borderColor: "transparent" },
  pressed: { backgroundColor: color.muted },
});
