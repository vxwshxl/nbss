import { router } from "expo-router";
import { Home, RotateCw } from "lucide-react-native";
import { Linking, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COMPANY, tel } from "@nbss/shared/company";

import { color, space } from "@/theme/tokens";

import { BrandLockup } from "./brand-lockup";
import { Button } from "./button";
import { Text } from "./text";

const COPY: Record<number, { title: string; body: string }> = {
  404: { title: "This screen is not at its post.", body: "The link may be old, or the screen has moved." },
  500: { title: "Something went wrong.", body: "The screen did not load. Nothing you entered has been lost." },
};

/** The app's full-screen error, matching the website's: the code, plain words and a way out. */
export function ErrorScreen({ code, onRetry, detail }: { code: 404 | 500; onRetry?: () => void; detail?: string }) {
  const insets = useSafeAreaInsets();
  const e = COPY[code]!;
  return (
    <View style={[styles.root, { paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6] }]}>
      <BrandLockup size="sm" />
      <View style={styles.body}>
        <Text weight="bold" style={styles.code}>
          {code}
        </Text>
        <Text variant="sectionTitle" weight="semibold" style={styles.centre}>
          {e.title}
        </Text>
        <Text variant="body" tone="muted" style={styles.centre}>
          {e.body}
        </Text>
        {detail ? (
          <Text variant="caption" tone="muted" mono style={styles.centre} numberOfLines={3}>
            {detail}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {onRetry && <Button label="Try again" icon={RotateCw} onPress={onRetry} fullWidth />}
          <Button
            label="Go to home"
            icon={Home}
            variant={onRetry ? "outline" : "default"}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            fullWidth
          />
        </View>
      </View>
      <Text variant="caption" tone="muted" onPress={() => void Linking.openURL(`tel:${tel(COMPANY.phone)}`)}>
        Need help? Call {COMPANY.phone}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "space-between", backgroundColor: color.appBg, paddingHorizontal: space[6] },
  body: { width: "100%", maxWidth: 420, alignItems: "center", gap: space[3] },
  code: { fontSize: 112, lineHeight: 116, letterSpacing: -4, color: color.primary },
  centre: { textAlign: "center" },
  actions: { width: "100%", gap: space[2], marginTop: space[4] },
});
