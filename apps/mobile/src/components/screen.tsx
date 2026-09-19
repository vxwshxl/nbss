import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, space } from "@/theme/tokens";

/**
 * The page frame.
 *
 * Insets are applied here rather than by a `SafeAreaView` per screen, because the
 * bottom inset has to be handled differently depending on whether a screen sits
 * inside the tab bar or over it — and a screen that gets that wrong puts its primary
 * button under the home indicator, which on a check-in screen means a guard who
 * cannot check in.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomInset = true,
  style,
  ...rest
}: ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  /** Off for a screen inside the tab bar, which already reserves the bottom inset. */
  bottomInset?: boolean;
}) {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingHorizontal: padded ? space[4] : 0,
    paddingTop: padded ? space[4] : 0,
    paddingBottom: (padded ? space[6] : 0) + (bottomInset ? insets.bottom : 0),
  };

  if (!scroll) {
    return (
      <View style={[styles.root, padding, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[padding, style]}
      // A list of shifts is read while walking. Momentum off would feel broken;
      // what matters is that the keyboard gets out of the way on a form.
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.appBg,
  },
});
