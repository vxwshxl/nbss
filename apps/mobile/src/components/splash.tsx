import { ActivityIndicator, StyleSheet, View } from "react-native";

import { color, space } from "@/theme/tokens";

import { BrandMark } from "./brand-mark";
import { Text } from "./text";

/**
 * While the app works out who is signed in: the badge and a spinner, never a sign-in
 * page that flashes at someone who is already signed in.
 */
export function Splash() {
  return (
    <View style={styles.center}>
      <BrandMark size={72} />
      <Text variant="label" weight="semibold" tone="muted">
        NBSS Kokrajhar
      </Text>
      <ActivityIndicator color={color.primary} style={styles.spin} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[3], backgroundColor: color.appBg },
  spin: { marginTop: space[2] },
});
