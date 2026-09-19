import { StyleSheet, View, type ViewProps } from "react-native";

import { color, radius, shadow, space } from "@/theme/tokens";

import { Text } from "./text";

/** A panel, matching the console's `Panel`. */
export function Card({
  title,
  subtitle,
  right,
  tone = "default",
  bare,
  children,
  style,
  ...rest
}: ViewProps & {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: "default" | "accent" | "danger";
  /** No inner padding — for a card whose body is a map or a full-width list. */
  bare?: boolean;
}) {
  return (
    <View style={[styles.card, tones[tone], style]} {...rest}>
      {(title || right) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && (
              <Text variant="caption" semibold tone={tone === "danger" ? "danger" : "default"}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text variant="caption" tone="muted">
                {subtitle}
              </Text>
            )}
          </View>
          {right}
        </View>
      )}
      <View style={bare ? undefined : styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: "hidden",
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  headerText: { flex: 1, gap: 2 },
  body: { padding: space[4], gap: space[3] },
});

const tones = StyleSheet.create({
  default: {},
  accent: { backgroundColor: color.accent, borderColor: "#c9e4d5" },
  danger: { backgroundColor: "#fdf0ef", borderColor: "#f3c9c7" },
});
