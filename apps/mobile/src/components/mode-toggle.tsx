import * as Haptics from "expo-haptics";
import { FlaskConical, Radio } from "lucide-react-native";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { useDataMode, type DataMode } from "@/lib/data-mode";
import { color, radius } from "@/theme/tokens";

import { Text } from "./text";

const SIDES = {
  test: { label: "Test", Icon: FlaskConical, fill: "#fbbf24", ink: "#4a3200", ledge: "#b7791f" },
  live: { label: "Live", Icon: Radio, fill: color.primary, ink: "#ffffff", ledge: "#006b4a" },
} as const;

/**
 * The header's Test / Live switch, the website's ModeToggle (components/shell/mode-toggle.tsx)
 * drawn the same way: a pill, the chosen side filled amber or green over a darker ledge.
 * Developers only. A switch remounts every screen on the chosen side (lib/data-mode.tsx).
 */
export function ModeToggle() {
  const { mode, setMode } = useDataMode();
  // The labels drop on the narrowest phones, where the header has no room for them.
  const labels = useWindowDimensions().width >= 380;

  const pick = (next: DataMode) => {
    if (next === mode) return;
    void Haptics.selectionAsync().catch(() => undefined);
    void setMode(next);
  };

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Data mode" style={[styles.pill, mode === "test" && styles.pillTest]}>
      {(["test", "live"] as const).map((m) => {
        const on = mode === m;
        const side = SIDES[m];
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityLabel={side.label}
            accessibilityState={{ checked: on }}
            onPress={() => pick(m)}
            hitSlop={4}
            style={({ pressed }) => [styles.ledge, on && { backgroundColor: side.ledge }, pressed && !on && styles.pressed]}
          >
            <View style={[styles.seg, !labels && styles.segIcon, on && { backgroundColor: side.fill }]}>
              <side.Icon size={14} color={on ? side.ink : color.mutedForeground} strokeWidth={2.2} />
              {labels && (
                <Text variant="caption" weight={on ? "extrabold" : "semibold"} tone="inherit" style={{ color: on ? side.ink : color.mutedForeground }}>
                  {side.label}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // `h-9 rounded-full border bg-card p-0.5 gap-0.5 shadow-xs`, amber-300 border on Test.
  pill: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    padding: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.card,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pillTest: { borderColor: "#fcd34d" },
  // The `shadow-[0_2px_0_…]` ledge: the darker colour two points below the fill.
  ledge: { height: 30, borderRadius: radius.full, alignSelf: "flex-start" },
  seg: { height: 28, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: radius.full },
  segIcon: { paddingHorizontal: 9 },
  pressed: { opacity: 0.6 },
});
