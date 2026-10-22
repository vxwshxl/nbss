import { useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { COMPANY } from "@nbss/shared/company";

import { color, font } from "@/theme/tokens";

import { BrandMark } from "./brand-mark";
import { Text } from "./text";

const SIZES = {
  sm: { mark: 34, word: 28, line: 11 },
  md: { mark: 48, word: 40, line: 15 },
  lg: { mark: 64, word: 54, line: 20 },
};

/**
 * The full lockup, as the website draws it:
 *
 *   [mark]  NBSS
 *   National Bodo
 *   Security Service
 *
 * The first row sets the width; each line under it is spread letter by letter to
 * exactly that width, so it ends where the last S ends. Done with layout rather
 * than SVG `textLength`, which iOS ignores.
 */
export function BrandLockup({
  size = "md",
  tone = color.foreground,
  style,
}: {
  size?: keyof typeof SIZES;
  /** Ink colour, for a dark panel. */
  tone?: string;
  style?: ViewStyle;
}) {
  const s = SIZES[size];
  const [width, setWidth] = useState(0);

  return (
    <View style={[styles.wrap, style]} accessible accessibilityLabel={COMPANY.name}>
      <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <BrandMark size={s.mark} />
        <Text
          weight="bold"
          tone="inherit"
          style={{ color: tone, fontSize: s.word, lineHeight: s.word * 1.05, letterSpacing: -s.word * 0.035 }}
        >
          {COMPANY.shortName}
        </Text>
      </View>
      {width > 0 &&
        ["National Bodo", "Security Service"].map((line) => (
          <View key={line} style={[styles.spread, { width }]}>
            {line.split("").map((ch, i) => (
              <Text
                key={i}
                tone="inherit"
                style={{
                  color: tone,
                  opacity: 0.72,
                  fontFamily: font.medium,
                  fontSize: s.line,
                  lineHeight: s.line * 1.2,
                  minWidth: ch === " " ? s.line * 0.35 : undefined,
                }}
              >
                {ch}
              </Text>
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  spread: { flexDirection: "row", justifyContent: "space-between" },
});
