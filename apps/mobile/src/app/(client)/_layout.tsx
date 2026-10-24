import { Splash } from "@/components/splash";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { ClipboardList, Building2 } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TopBar } from "@/components/top-bar";
import { Avatar } from "@/components/avatar";
import { photoOf, useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/push";
import { color, font } from "@/theme/tokens";

/** What the tab bar hands an icon. Spelled out: SDK 58's js-tabs types do not infer it. */
type TabIcon = { color: ColorValue; size: number };

export default function ClientLayout() {
  const { session, role, profile } = useAuth();
  const insets = useSafeAreaInsets();

  // A client is told when an SOS is raised at their own site (sites.notify_client_on_sos),
  // which only reaches a closed app by push.
  useEffect(() => {
    if (session) void registerForPush();
  }, [session]);

  if (session === undefined) return <Splash />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && role !== "client") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        /**
         * The console's topbar, as the real navigation header rather than something each
         * screen draws for itself. Two reasons: it persists across a tab change instead of
         * unmounting and remounting, and it owns the status-bar inset in one place — which
         * is why every screen underneath passes `topInset={false}` to <Screen>.
         */
        header: () => (
          <TopBar role={role ?? "client"} name={profile?.full_name ?? "-"} account={false} />
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
      <Tabs.Screen
        name="site"
        options={{
          title: "My sites",
          tabBarIcon: ({ color: c, size }: TabIcon) => <Building2 size={size} color={c as string} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "Book guards",
          tabBarIcon: ({ color: c, size }: TabIcon) => (
            <ClipboardList size={size} color={c as string} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarIcon: ({ focused, size }: TabIcon & { focused: boolean }) => (
            <Avatar name={profile?.full_name ?? "?"} uri={profile?.avatar_url ?? photoOf(session)} size={size} ring={focused ? color.primary : undefined} />
          ),
        }}
      />
    </Tabs>
  );
}
