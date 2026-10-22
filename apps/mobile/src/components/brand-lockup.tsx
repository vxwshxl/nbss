import { useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";

import { COMPANY } from "@nbss/shared/company";

import { color, font } from "@/theme/tokens";

import { BrandMark } from "./brand-mark";
import { Text } from "./text";

const SIZES = {
  sm: { mark: 34, word: 28 },
  md: { mark: 48, word: 40 },
  lg: { mark: 64, word: 54 },
};

/**
 * The full lockup, as the website draws it:
 *
 *   [mark]  NBSS
 *   National Bodo
 *   Security Service
 *
 * The first row sets the width; the two lines under it are SVG text stretched to
 * exactly that width (`textLength`), so they end where the last S ends.
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
  const height = width * 0.262;

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
      {width > 0 && (
        <Svg width={width} height={height} viewBox="0 0 1000 262" style={styles.lines}>
          {["National Bodo", "Security Service"].map((line, i) => (
            <SvgText
              key={line}
              x={0}
              y={i === 0 ? 100 : 236}
              textLength={1000}
              lengthAdjust="spacing"
              fill={tone}
              fillOpacity={0.72}
              fontSize={118}
              fontFamily={font.medium}
            >
              {line}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  lines: { marginTop: 6 },
});
