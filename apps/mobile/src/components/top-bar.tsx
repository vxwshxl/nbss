import { ShieldCheck } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY } from "@nbss/shared/company";
import { ROLE_LABEL, type Role } from "@nbss/shared/identity";

import { useLayout } from "@/hooks/use-breakpoint";
import { color, radius, space } from "@/theme/tokens";

import { Avatar } from "./avatar";
import { Text } from "./text";

/**
 * The topbar, ported from the console's AppShell.
 *
 * On the web this is a 56px sticky strip with a hairline under it: the wordmark and the
 * role on the left, the user menu on the right. It is the single most recognisable piece
 * of the console's chrome, and having it here is most of why the app reads as the same
 * product rather than a separate one that happens to share a colour.
 *
 * It owns the status-bar inset, so a screen sitting underneath one passes
 * `topInset={false}` to <Screen> — otherwise the space gets reserved twice and every page
 * starts an inch down.
 */
export function TopBar({
  role,
  name,
  onPressAccount,
  right,
}: {
  role: Role;
  name: string;
  onPressAccount?: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { gutter, contentMaxWidth } = useLayout();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.inner,
          { paddingHorizontal: gutter, maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
        ]}
      >
        <View style={styles.mark}>
          <ShieldCheck size={18} strokeWidth={2.2} color={color.primary} />
        </View>

        <View style={styles.brandText}>
          <Text variant="label" weight="bold">
            {COMPANY.shortName}
          </Text>
          {/* The console renders the role as the wordmark's secondary line, in exactly
              this position. */}
          <Text variant="micro" tone="muted" weight="medium">
            {ROLE_LABEL[role]}
          </Text>
        </View>

        {right}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your account"
          onPress={onPressAccount}
          disabled={!onPressAccount}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={name} size={34} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    // `bg-background/85 backdrop-blur` on the web. Solid here: a blur over a scrolling
    // list costs a full-screen composite every frame on a mid-range Android, and the
    // console's own bar is barely translucent anyway.
    backgroundColor: color.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineSoft,
  },
  inner: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[2],
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    // `bg-primary/12`, flattened.
    backgroundColor: "#e0f0e8",
  },
  brandText: { flex: 1, gap: 0 },
  pressed: { opacity: 0.6 },
});
