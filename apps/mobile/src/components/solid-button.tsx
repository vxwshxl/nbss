import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

/** A colour and the darker ledge under it. */
const TONES = {
  green: { bg: "#059669", ledge: "#047857" },
  amber: { bg: "#d97706", ledge: "#b45309" },
  ink: { bg: "#1f2937", ledge: "#030712" },
  red: { bg: color.sos, ledge: color.sosDeep },
  blue: { bg: "#2563eb", ledge: "#1d4ed8" },
} as const;

export type SolidTone = keyof typeof TONES;

/**
 * The big, solid, colour-coded button used where a guard acts under pressure: SOS
 * Resolved / False alarm, Check out, Call desk. A ledge underneath gives it depth and
 * it sinks onto it when pressed, so it reads as a button at a glance, in sunlight.
 */
export function SolidButton({
  label,
  icon: Icon,
  tone,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  icon?: LucideIcon;
  tone: SolidTone;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = TONES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: t.bg, borderBottomColor: t.ledge },
        pressed && styles.pressed,
        (disabled || loading) && styles.inert,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : Icon ? <Icon size={20} color="#fff" strokeWidth={2.4} /> : null}
      <Text variant="label" weight="bold" tone="inherit" style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    borderBottomWidth: 3,
  },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  inert: { opacity: 0.6 },
  text: { color: "#fff" },
});
