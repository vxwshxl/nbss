import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { HIT_SLOP, TOUCH_MIN, color, radius, space, text, weight } from "@/theme/tokens";

import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

/**
 * The button.
 *
 * Two things worth knowing about the choices here:
 *
 *   The press feedback is opacity plus a haptic tick, not a scale animation. Scale
 *   reads as playful, and half the taps in this app are "mark me present at a gate"
 *   or "acknowledge that someone needs help" — a tick that confirms the finger
 *   landed is more use than a bounce, especially when the screen is being looked at
 *   in the rain.
 *
 *   Disabled while loading, and the label stays. A spinner that replaces the text
 *   leaves someone who looked away unsure what they pressed.
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  onPress,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: PressableProps["style"];
}) {
  const inert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inert), busy: Boolean(loading) }}
      disabled={inert}
      hitSlop={HIT_SLOP}
      onPress={(event) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={(state) => [
        styles.base,
        sizes[size],
        variants[variant],
        state.pressed && styles.pressed,
        inert && styles.inert,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={labelTone[variant] === "inverse" ? color.primaryForeground : color.foreground} />
        ) : (
          icon
        )}
        <Text
          variant={size === "lg" ? "bodyLarge" : "body"}
          tone={labelTone[variant]}
          semibold
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const labelTone = {
  primary: "inverse",
  danger: "inverse",
  secondary: "default",
  ghost: "primary",
} as const;

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: TOUCH_MIN,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  pressed: { opacity: 0.82 },
  inert: { opacity: 0.45 },
});

const sizes = StyleSheet.create({
  md: { paddingHorizontal: space[4], paddingVertical: space[3] },
  lg: { paddingHorizontal: space[5], paddingVertical: space[4], minHeight: 56 },
});

const variants = StyleSheet.create({
  primary: { backgroundColor: color.primary },
  danger: { backgroundColor: color.destructive },
  secondary: {
    backgroundColor: color.secondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  ghost: { backgroundColor: "transparent" },
});

/** The small text-only action in a card header or beside a field. */
export function LinkButton({
  label,
  onPress,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "muted" | "danger";
}) {
  return (
    <Pressable accessibilityRole="button" hitSlop={HIT_SLOP} onPress={onPress}>
      {({ pressed }) => (
        <Text
          variant="caption"
          semibold
          tone={tone === "muted" ? "muted" : tone === "danger" ? "danger" : "primary"}
          style={[{ fontSize: text.caption.fontSize, fontWeight: weight.semibold }, pressed && { opacity: 0.6 }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
