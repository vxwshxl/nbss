import { Splash } from "@/components/splash";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { CalendarClock, Radar, Siren, Users } from "lucide-react-native";
import { StyleSheet, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect } from "react";

import { isStaff } from "@nbss/shared/identity";

import { TopBar } from "@/components/top-bar";
import { Avatar } from "@/components/avatar";
import { photoOf, useAuth } from "@/lib/auth";
import { askForegroundOnce } from "@/lib/location";
import { registerForPush } from "@/lib/push";
import { color, font } from "@/theme/tokens";

type TabIcon = { color: ColorValue; size: number };

/**
 * Admins and supervisors.
 *
 * Push is registered here as well as in the guard layout: staff are in the SOS fan-out
 * (`sos_recipients` in 0006 includes every active admin and supervisor, wherever they
 * are), so a supervisor without a registered device is a supervisor who never hears the
 * alarm.
 */
export default function StaffLayout() {
  const { session, role, profile } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!session) return;
    void askForegroundOnce();
    void registerForPush();
  }, [session]);

  if (session === undefined) return <Splash />;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && !isStaff(role)) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        header: () => <TopBar role={role ?? "supervisor"} name={profile?.full_name ?? "-"} account={false} />,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: {
          backgroundColor: color.card,
          borderTopColor: color.lineSoft,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: color.appBg },
      }}
    >
      {/* The office in a pocket: the map, SOS, today's duties, the guards, and the account. */}
      <Tabs.Screen name="live" options={{ title: "Live", tabBarIcon: ({ color: c, size }: TabIcon) => <Radar size={size} color={c as string} strokeWidth={2} /> }} />
      <Tabs.Screen name="sos" options={{ title: "SOS", tabBarIcon: ({ color: c, size }: TabIcon) => <Siren size={size} color={c as string} strokeWidth={2} /> }} />
      <Tabs.Screen name="today" options={{ title: "Today", tabBarIcon: ({ color: c, size }: TabIcon) => <CalendarClock size={size} color={c as string} strokeWidth={2} /> }} />
      <Tabs.Screen name="guards" options={{ title: "Guards", tabBarIcon: ({ color: c, size }: TabIcon) => <Users size={size} color={c as string} strokeWidth={2} /> }} />
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
