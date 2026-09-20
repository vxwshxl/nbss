import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from "react-native";

import { color, font, text } from "@/theme/tokens";

type Variant = keyof typeof text;
type Tone = "default" | "muted" | "primary" | "danger" | "inverse" | "inherit";
type Weight = "regular" | "medium" | "semibold" | "bold";

/**
 * Typography.
 *
 * Weight is applied by swapping `fontFamily`, not by setting `fontWeight`. Geist arrives
 * from `@expo-google-fonts/geist` as separate static files per weight, and asking the
 * platform for `fontWeight: "600"` on a 400-weight file gets either nothing on Android
 * or a synthesised fake bold on iOS — which sits next to the real semibold in a Panel
 * header and looks subtly broken.
 *
 * `allowFontScaling` is left on. The people reading this are outdoors and often over
 * fifty; someone who has turned their system font up did it for a reason, and a layout
 * that breaks under it is the layout's problem.
 */
export function Text({
  variant = "body",
  tone = "default",
  weight = "regular",
  mono,
  uppercase,
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: Tone;
  weight?: Weight;
  /** Tabular figures, for a clock, a distance or a count that changes in place. */
  mono?: boolean;
  uppercase?: boolean;
}) {
  const family: TextStyle = {
    fontFamily: mono
      ? weight === "regular"
        ? font.mono
        : font.monoMedium
      : font[weight],
  };

  return (
    <RNText
      style={[
        text[variant],
        family,
        tone !== "inherit" && tones[tone],
        // Geist's tabular figures come from the font itself; this asks for the feature
        // even on the proportional family, so a changing number does not jitter.
        styles.tnum,
        uppercase && styles.uppercase,
        style,
      ]}
      {...rest}
    />
  );
}

/** The small capitalised line above a page title, matching the console's PageHeader. */
export function Eyebrow({ children, style, ...rest }: TextProps) {
  return (
    <Text variant="eyebrow" weight="bold" tone="muted" uppercase style={style} {...rest}>
      {children}
    </Text>
  );
}

const tones = StyleSheet.create({
  default: { color: color.foreground },
  muted: { color: color.mutedForeground },
  primary: { color: color.primary },
  danger: { color: color.destructive },
  inverse: { color: color.primaryForeground },
  inherit: {},
});

const styles = StyleSheet.create({
  tnum: { fontVariant: ["tabular-nums"] },
  uppercase: { textTransform: "uppercase" },
});
