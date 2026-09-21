import { ScrollView, StyleSheet, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "@/hooks/use-breakpoint";
import { color, space } from "@/theme/tokens";

import { AppBackground } from "./app-background";

/**
 * The page frame, and where responsiveness actually lives.
 *
 * Content is centred inside a maximum width rather than stretched edge to edge. On a
 * phone the cap is the screen, so nothing changes; on a tablet it stops a Panel becoming
 * 1000 points wide, which is the single thing that makes an app look like a phone app
 * someone dragged onto a bigger screen. The console caps its own content for the same
 * reason.
 *
 * Insets are applied here rather than by a SafeAreaView per screen, because the bottom
 * one has to be handled differently inside a tab bar than over it — and a screen that
 * gets that wrong puts its primary button under the home indicator, which on a check-in
 * screen means a guard who cannot check in.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  topInset = true,
  bottomInset = true,
  refreshControl,
  style,
  contentStyle,
  ...rest
}: ViewProps & {
  scroll?: boolean;
  padded?: boolean;
  /**
   * Reserve the status-bar inset.
   *
   * On by default, and this is the bug it fixes: the tab screens are declared
   * `headerShown: false`, so nothing above them was reserving that space and the first
   * line of every screen rendered underneath the clock and the battery icon. A navigation
   * header does reserve it, so a screen pushed onto a Stack that has one passes `false`.
   */
  topInset?: boolean;
  /** Off for a screen inside the tab bar, which already reserves the bottom inset. */
  bottomInset?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  contentStyle?: ViewProps["style"];
}) {
  const insets = useSafeAreaInsets();
  const { gutter, contentMaxWidth } = useLayout();

  const frame = {
    width: "100%" as const,
    maxWidth: contentMaxWidth,
    alignSelf: "center" as const,
    paddingHorizontal: padded ? gutter : 0,
    paddingTop: (padded ? gutter : 0) + (topInset ? insets.top : 0),
    // The console ends a page with `space-y-6` worth of air; a phone needs more, because
    // the last card would otherwise sit flush against the tab bar with nothing under it.
    paddingBottom: (padded ? space[10] : 0) + (bottomInset ? insets.bottom : 0),
  };

  if (!scroll) {
    return (
      <AppBackground>
        <View style={[styles.fill, style]} {...rest}>
          <View style={[frame, styles.fill, contentStyle]}>{children}</View>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        {...rest}
      >
        <View style={[frame, contentStyle]}>{children}</View>
      </ScrollView>
    </AppBackground>
  );
}

/**
 * A responsive grid, for a row of StatCards.
 *
 * Wraps rather than using a FlatList with `numColumns`: the number of columns changes on
 * rotation, and FlatList needs a `key` change to re-lay-out when `numColumns` does, which
 * is a remount and a visible flash. Flex wrapping just reflows.
 */
export function CardGrid({
  columns,
  children,
  style,
  ...rest
}: ViewProps & { columns: number }) {
  const items = Array.isArray(children) ? children : [children];

  return (
    <View style={[styles.grid, style]} {...rest}>
      {items.filter(Boolean).map((child, i) => (
        <View
          key={i}
          style={{
            // Gap is accounted for in the basis so the last card in a row does not wrap
            // on its own at fractional widths.
            flexBasis: `${100 / columns}%`,
            maxWidth: `${100 / columns}%`,
            padding: space[1.5 as 2],
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // Negative inset cancels the per-item padding above, so the grid's outer edge lines
    // up with the Panels above and below it.
    margin: -space[1.5 as 2],
  },
});

export { color };
