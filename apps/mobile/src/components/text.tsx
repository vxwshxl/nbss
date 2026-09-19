import { Text as RNText, StyleSheet, type TextProps } from "react-native";

import { color, text, weight } from "@/theme/tokens";

type Variant = keyof typeof text;
type Tone = "default" | "muted" | "primary" | "danger" | "inverse";

/**
 * Typography, as a component rather than a set of styles to remember.
 *
 * `allowFontScaling` is deliberately left on. The people reading this are outdoors
 * and often over fifty; someone who has turned their system font up has done so for
 * a reason, and a layout that breaks under it is the layout's problem. The screens
 * are built to survive it.
 */
export function Text({
  variant = "body",
  tone = "default",
  bold,
  semibold,
  medium,
  mono,
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: Tone;
  bold?: boolean;
  semibold?: boolean;
  medium?: boolean;
  /** Tabular figures for a clock, a distance or a count that changes in place. */
  mono?: boolean;
}) {
  return (
    <RNText
      style={[
        text[variant],
        tones[tone],
        bold && { fontWeight: weight.bold },
        semibold && { fontWeight: weight.semibold },
        medium && { fontWeight: weight.medium },
        mono && styles.mono,
        style,
      ]}
      {...rest}
    />
  );
}

const tones = StyleSheet.create({
  default: { color: color.foreground },
  muted: { color: color.mutedForeground },
  primary: { color: color.primary },
  danger: { color: color.destructive },
  inverse: { color: color.primaryForeground },
});

const styles = StyleSheet.create({
  mono: {
    fontVariant: ["tabular-nums"],
  },
});
