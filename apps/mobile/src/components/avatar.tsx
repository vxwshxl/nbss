import { StyleSheet, View } from "react-native";

import { initials } from "@nbss/shared/identity";

import { color, radius } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The initials avatar, matching the console's. `initials` comes from the shared package,
 * so "Diyan Brahma" is "DB" in the browser and "DB" on a phone.
 */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: radius.full }]}
      accessible
      accessibilityLabel={name}
    >
      <Text
        weight="semibold"
        tone="muted"
        style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.42) }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
});
