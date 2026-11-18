import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { Text } from "@/components/text";
import { color, space } from "@/theme/tokens";

/**
 * A long list drawn a slice at a time. Two hundred guards with photos, drawn at once,
 * make the screen slow to open and to scroll; a search or a filter narrows it anyway.
 * `resetKey` is the filter: changing it starts again from the first slice.
 */
export function useShowMore<T>(list: T[], resetKey: string, step = 40) {
  // Kept with the filter it was counted for, so a new filter starts from one slice.
  const [shown, setShown] = useState({ key: resetKey, count: step });
  const count = shown.key === resetKey ? shown.count : step;
  return {
    visible: list.length > count ? list.slice(0, count) : list,
    rest: Math.max(0, list.length - count),
    more: () => setShown({ key: resetKey, count: count + step }),
  };
}

/** The "Show 40 more" row at the end of such a list; nothing once all of it shows. */
export function ShowMoreRow({ rest, step = 40, onPress }: { rest: number; step?: number; onPress: () => void }) {
  if (rest <= 0) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text variant="label" weight="semibold" tone="primary">
        Show {Math.min(step, rest)} more · {rest} left
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingVertical: space[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  pressed: { opacity: 0.6 },
});
