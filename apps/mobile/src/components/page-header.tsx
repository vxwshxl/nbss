import { StyleSheet, View } from "react-native";

import { space } from "@/theme/tokens";

import { Eyebrow, Text } from "./text";

/**
 * A screen's title block, ported from apps/web/src/components/console/page-header.tsx.
 *
 * Descriptions are deliberately not rendered here either — the web component's comment
 * is that the title alone is enough context and a subtitle only costs vertical space,
 * which is truer on a phone than it is on a monitor.
 */
export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  /** The section this screen belongs to, where the title alone would be ambiguous. */
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.text}>
        {eyebrow && <Eyebrow style={styles.eyebrow}>{eyebrow}</Eyebrow>}
        <Text variant="pageTitle" weight="semibold" numberOfLines={2}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space[4],
    // `mb-6` on the console. The title needs air under it or it crowds the first card.
    marginBottom: space[2],
  },
  text: { flex: 1, minWidth: 0 },
  eyebrow: { marginBottom: space[1.5 as 2] },
});
