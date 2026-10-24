import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { initials } from "@nbss/shared/identity";

import { color, radius } from "@/theme/tokens";

import { Text } from "./text";

/**
 * The initials avatar, matching the console's. `initials` comes from the shared package,
 * so "Diyan Brahma" is "DB" in the browser and "DB" on a phone. With `uri` (the Google
 * account's photo) the picture is shown instead, initials underneath while it loads.
 */
export function Avatar({ name, size = 36, uri, ring }: { name: string; size?: number; uri?: string | null; ring?: string }) {
  if (uri) {
    return (
      <View
        style={[styles.avatar, { width: size, height: size, borderRadius: radius.full, overflow: "hidden" }, ring ? { borderWidth: 2, borderColor: ring } : null]}
        accessible
        accessibilityLabel={name}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" transition={150} />
      </View>
    );
  }
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: radius.full }, ring ? { borderWidth: 2, borderColor: ring } : null]}
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
