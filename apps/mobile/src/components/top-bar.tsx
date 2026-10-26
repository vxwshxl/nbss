import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY } from "@nbss/shared/company";
import { roleLabel, type Role } from "@nbss/shared/identity";

import { useLayout } from "@/hooks/use-breakpoint";
import { color, space } from "@/theme/tokens";

import { Avatar } from "./avatar";
import { BrandMark } from "./brand-mark";
import { ModeToggle } from "./mode-toggle";
import { Nibo } from "./nibo/nibo";
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
  trade,
  name,
  onPressAccount,
  right,
  account = true,
}: {
  role: Role;
  /** Shown as "Housekeeper" for a guard in the housekeeping trade. */
  trade?: string | null;
  name: string;
  onPressAccount?: () => void;
  right?: React.ReactNode;
  /** Off where the tab bar already carries the person (a guard's "Me" tab). */
  account?: boolean;
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
        <BrandMark size={34} />

        <View style={styles.brandText}>
          <Wordmark role={roleLabel(role, trade)} />
        </View>

        {/* The website's Test / Live switch, for developers, as its header has it. */}
        {role === "developer" && <ModeToggle />}

        {right}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Nibo, your assistant"
          onPress={() => router.push("/assistant")}
          style={({ pressed }) => [styles.ask, pressed && styles.pressed]}
        >
          <Nibo size={30} still style={styles.askNibo} />
        </Pressable>

        {account && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your account"
          onPress={onPressAccount}
          disabled={!onPressAccount}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Avatar name={name} size={34} />
        </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * "NBSS" over the role, the role spread to exactly the wordmark's width — as the
 * website's logo sets "National Bodo Security Service" under "NBSS". The letters are
 * laid out in a row as wide as the wordmark and spaced evenly, which lines up on every
 * platform and font size (letter-spacing maths does not: each renderer rounds it
 * differently, and the last letter wrapped).
 */
function Wordmark({ role }: { role: string }) {
  const [mark, setMark] = useState(0);
  return (
    <View style={styles.wordmark}>
      <Text variant="label" weight="bold" onLayout={(e) => setMark(e.nativeEvent.layout.width)}>
        {COMPANY.shortName}
      </Text>
      <View style={[styles.spread, mark ? { width: mark } : styles.hidden]} accessible accessibilityLabel={role}>
        {[...role].map((ch, i) => (
          <Text key={i} variant="micro" tone="muted" weight="medium" importantForAccessibility="no">
            {ch === " " ? "\u00a0" : ch}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { alignSelf: "flex-start" },
  spread: { flexDirection: "row", justifyContent: "space-between" },
  hidden: { opacity: 0 },
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
  brandText: { flex: 1, gap: 0 },
  pressed: { opacity: 0.6 },
  ask: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#10b98140",
    backgroundColor: color.accent,
  },
  askNibo: { marginTop: 5 },
});
