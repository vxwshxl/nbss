import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { color } from "@/theme/tokens";

/**
 * The console's page background.
 *
 * globals.css layers three very soft radial "blooms" over `--app-bg` — a violet, a warm
 * amber and a green — so the grey behind the cards is not flat. React Native has no
 * radial gradient, so this approximates them with two large, heavily-feathered linear
 * gradients pinned to opposite corners. At these opacities the difference between a
 * radial and a wide linear wash is not perceptible; what carries is that the background
 * has a faint colour temperature rather than being dead grey.
 *
 * `pointerEvents="none"` throughout: this sits behind the content and must never
 * intercept a tap meant for a card, which on the duty screen could be the SOS button.
 */
export function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* --app-bloom-1, the cool violet, from the top left. */}
        <LinearGradient
          colors={["#e7e3f7", "#f3f4f500"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
        {/* --app-bloom-3, the brand green, from the bottom right — so the page picks up
            the same hue as the buttons rather than reading as neutral grey. */}
        <LinearGradient
          colors={["#f3f4f500", "#e2f3ea"]}
          start={{ x: 0.3, y: 0.45 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.appBg },
});
