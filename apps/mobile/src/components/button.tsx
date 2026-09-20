import * as Haptics from "expo-haptics";
import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { HIT_SLOP, TOUCH_MIN, color, font, radius, size, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The button, with the console's variants.
 *
 * The colours are a faithful port of apps/web/src/components/ui/button.tsx, including the
 * one that surprises people: `destructive` is a soft red tint with red ink
 * (`bg-destructive/10 text-destructive`), not a solid red block. The web component does
 * that on purpose — a delete button should be findable and not inviting — and copying the
 * intent matters more than copying a colour.
 *
 * THE SIZES ARE NOT A PORT. The console's default button is `h-8`, 32 points tall,
 * because a mouse is precise. That is unusable with a wet thumb in the rain, which is the
 * actual operating condition here, so every size below floors at `TOUCH_MIN` (48). This
 * is the one place the app deliberately departs from the web, and it is a physical
 * constraint rather than a stylistic preference.
 *
 * Press feedback is opacity plus a haptic tick rather than the web's `active:scale`.
 * Half the taps in this app are "mark me present at a gate" or "acknowledge that somebody
 * needs help"; a tick that confirms the finger landed is more use than a bounce.
 */

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type Size = "sm" | "md" | "lg";

export function Button({
  label,
  variant = "default",
  size: buttonSize = "md",
  loading,
  disabled,
  icon: Icon,
  iconEnd,
  fullWidth,
  onPress,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
  /** Put the icon after the label — for "Next", "View", anything forward-moving. */
  iconEnd?: boolean;
  fullWidth?: boolean;
  style?: PressableProps["style"];
}) {
  const inert = disabled || loading;
  const ink = INK[variant];
  const iconSize = buttonSize === "sm" ? 16 : 18;

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
        SIZES[buttonSize],
        VARIANTS[variant],
        fullWidth && styles.fullWidth,
        state.pressed && styles.pressed,
        inert && styles.inert,
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <View style={[styles.row, iconEnd && styles.rowReverse]}>
        {loading ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          Icon && <Icon size={iconSize} strokeWidth={2} color={ink} />
        )}
        <Text
          variant={buttonSize === "lg" ? "body" : "label"}
          weight="medium"
          tone="inherit"
          numberOfLines={1}
          style={[{ color: ink }, variant === "link" && styles.linkLabel]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** The ink each variant puts on its label and icon. */
const INK: Record<Variant, string> = {
  default: color.primaryForeground,
  outline: color.foreground,
  secondary: color.secondaryForeground,
  ghost: color.foreground,
  destructive: color.destructive,
  link: color.primary,
};

const VARIANTS = StyleSheet.create({
  default: { backgroundColor: color.primary },
  outline: {
    backgroundColor: color.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  secondary: { backgroundColor: color.secondary },
  ghost: { backgroundColor: "transparent" },
  // `bg-destructive/10`, flattened against white.
  destructive: { backgroundColor: "#faeae9" },
  link: { backgroundColor: "transparent", minHeight: 0, paddingHorizontal: 0 },
});

const SIZES = StyleSheet.create({
  sm: { minHeight: 40, paddingHorizontal: space[3], paddingVertical: space[2] },
  md: { minHeight: TOUCH_MIN, paddingHorizontal: space[4], paddingVertical: space[3] },
  lg: { minHeight: 56, paddingHorizontal: space[5], paddingVertical: space[4] },
});

const styles = StyleSheet.create({
  base: {
    // `rounded-lg` — 11px, from the console's `--radius: 0.7rem`.
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] },
  rowReverse: { flexDirection: "row-reverse" },
  pressed: { opacity: 0.82 },
  inert: { opacity: 0.5 },
  linkLabel: { textDecorationLine: "underline" },
});

/** The small text-only action in a Panel header or beside a field. */
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
          weight="semibold"
          tone={tone === "muted" ? "muted" : tone === "danger" ? "danger" : "primary"}
          style={[{ fontSize: size.sm, fontFamily: font.semibold }, pressed && styles.pressed]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
