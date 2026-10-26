import { Splash } from "@/components/splash";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { CalendarDays, MapPinned, Siren } from "lucide-react-native";
import { useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { FloatingSos } from "@/components/floating-sos";
import { SosRinger } from "@/components/sos-ringer";
import { TopBar } from "@/components/top-bar";
import { photoOf, useAuth } from "@/lib/auth";
import { registerHandset } from "@/lib/device";
import { LiveFeedProvider } from "@/lib/live-feed";
import { askForegroundOnce } from "@/lib/location";
import { ensureTracking } from "@/lib/keep-alive";
import { registerForPush } from "@/lib/push";
import { color, font } from "@/theme/tokens";

/** What the tab bar hands an icon. Spelled out: SDK 58's js-tabs types do not infer it. */
type TabIcon = { color: ColorValue; size: number };

/**
 * A guard's app.
 *
 * Push registration happens here rather than at the root, because it needs a signed-in
 * session — `register_device` takes the profile from the JWT — and because a client who
 * never receives an SOS does not need to be asked for notification permission at all.
 *
 * It runs on every mount, not once. An Expo push token can be rotated by the OS, and
 * these phones are handed between shifts: the token has to be re-pointed at whoever is
 * signed in now, which is exactly what `register_device`'s upsert-on-token does.
 */
export default function GuardLayout() {
  const { session, role, profile } = useAuth();
  const insets = useSafeAreaInsets();
  // The photo saved on the profile (copied from Google at sign-in), else the session's.
  const photo = profile?.avatar_url ?? photoOf(session);

  useEffect(() => {
    if (!session) return;
    // Which phone this is, every launch: the Devices page and the check-in rule read it.
    void askForegroundOnce().then(() => registerHandset());
    // On duty but not tracking (the app was swiped away and the battery saver
    // stopped it, or the phone restarted): start again now, and every time the
    // app comes back to the front. Sends anything walked offline, too.
    void ensureTracking();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void ensureTracking();
        void registerHandset();
      }
    });
    void registerForPush().then((result) => {
      if (!result.ok && result.reason !== "simulator") {
        // Not shown to the guard as an error, because there is nothing useful they can
        // do about most of these. The duty screen surfaces the one they can act on —
        // a denied permission — by checking the state itself.
        console.warn("[push] not registered:", result.reason, result.detail ?? "");
      }
    });
    return () => sub.remove();
  }, [session]);

  if (session === undefined) return <Splash />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && role !== "guard") return <Redirect href="/" />;

  return (
    <LiveFeedProvider>
    <View style={styles.fill}>
    <Tabs
      screenOptions={{
        /**
         * The console's topbar, as the real navigation header rather than something each
         * screen draws for itself. Two reasons: it persists across a tab change instead of
         * unmounting and remounting, and it owns the status-bar inset in one place — which
         * is why every screen underneath passes `topInset={false}` to <Screen>.
         */
        header: () => (
          <TopBar role={role ?? "guard"} name={profile?.full_name ?? "-"} account={false} />
        ),
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        /**
         * The bottom inset is added to the bar's own height rather than left to the
         * navigator. Without it the labels sat under the home indicator and were clipped
         * mid-word — "Duty" rendered as "Dut". `height` has to grow with the padding or
         * the padding just eats the label's space instead of making room for it.
         */
        tabBarStyle: {
          backgroundColor: color.card,
          borderTopColor: color.lineSoft,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
        },
        // Geist, so the tab bar does not betray the system font under a screen full of it.
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: color.appBg },
      }}
    >
      {/* The same lucide icons the console's nav uses, from lucide-react-native — the
          packages are pinned to the same version, so these are the identical glyphs. */}
      {/* Four tabs: the map with the one thing to do, the roster, open SOS alerts, and the account. */}
      <Tabs.Screen
        name="duty"
        options={{
          title: "Duty",
          tabBarIcon: ({ color: c, size }: TabIcon) => <MapPinned size={size} color={c as string} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="duties"
        options={{
          title: "My duties",
          tabBarIcon: ({ color: c, size }: TabIcon) => <CalendarDays size={size} color={c as string} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "SOS",
          tabBarIcon: ({ color: c, size }: TabIcon) => <Siren size={size} color={c as string} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          // The guard's own face (their Google photo, or initials) where the icon would be.
          tabBarIcon: ({ focused, size }: TabIcon & { focused: boolean }) => (
            <Avatar name={profile?.full_name ?? "?"} uri={photo} size={size} ring={focused ? color.primary : undefined} />
          ),
        }}
      />
    </Tabs>
      {/* On every tab, above the tab bar: hold for help from wherever the guard is. */}
      <FloatingSos bottom={64 + insets.bottom + 14} />
      {/* Rings and calls out an SOS this person has not opened yet, whoever raised it. */}
      <SosRinger />
    </View>
    </LiveFeedProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
