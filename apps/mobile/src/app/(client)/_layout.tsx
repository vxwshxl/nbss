import { Redirect, Tabs } from "expo-router";
import { ClipboardList, ShieldCheck } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/lib/auth";
import { color, font } from "@/theme/tokens";

export default function ClientLayout() {
  const { session, role, profile } = useAuth();
  const insets = useSafeAreaInsets();

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
          <TopBar role={role ?? "client"} name={profile?.full_name ?? "—"} />
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
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 6,
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
          tabBarIcon: ({ color: c, size }) => <ShieldCheck size={size} color={c} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "Book guards",
          tabBarIcon: ({ color: c, size }) => (
            <ClipboardList size={size} color={c} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
