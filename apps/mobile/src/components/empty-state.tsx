import type { LucideIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { color, radius, space } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The console's empty state, ported: a muted circular icon, a short statement of fact, and
 * a sentence explaining what would make it fill up.
 *
 * It appeared inline in four screens here with slightly different padding each time. More
 * to the point, an empty table with nothing in it is ambiguous — "nobody is checked in"
 * and "you are not allowed to see this" look identical — so the explanatory line is not
 * decoration, it is the thing that makes the blank readable.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.chip}>
        <Icon size={20} strokeWidth={1.75} color={color.mutedForeground} />
      </View>
      <Text variant="label" weight="medium" style={styles.centred}>
        {title}
      </Text>
      {body && (
        <Text variant="label" tone="muted" style={[styles.centred, styles.body]}>
          {body}
        </Text>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  // `px-6 py-14` on the console — generous, because an empty state that hugs its edges
  // reads as an error rather than a resting state.
  wrap: {
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[6],
    paddingVertical: space[12],
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.muted,
    marginBottom: space[1],
  },
  centred: { textAlign: "center" },
  body: { maxWidth: 380 },
});
