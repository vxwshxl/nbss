import { Redirect, Tabs } from "expo-router";
import { CircleUserRound, Map, ShieldCheck } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/push";
import { color, font } from "@/theme/tokens";

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
  const { session, role } = useAuth();

  useEffect(() => {
    if (!session) return;
    void registerForPush().then((result) => {
      if (!result.ok && result.reason !== "simulator") {
        // Not shown to the guard as an error, because there is nothing useful they can
        // do about most of these. The duty screen surfaces the one they can act on —
        // a denied permission — by checking the state itself.
        console.warn("[push] not registered:", result.reason, result.detail ?? "");
      }
    });
  }, [session]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && role !== "guard") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: {
          backgroundColor: color.card,
          borderTopColor: color.lineSoft,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        // Geist, so the tab bar does not betray the system font under a screen full of it.
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: color.appBg },
      }}
    >
      {/* The same lucide icons the console's nav uses, from lucide-react-native — the
          packages are pinned to the same version, so these are the identical glyphs. */}
      <Tabs.Screen
        name="duty"
        options={{
          title: "Duty",
          tabBarIcon: ({ color: c, size }) => <ShieldCheck size={size} color={c} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Site",
          tabBarIcon: ({ color: c, size }) => <Map size={size} color={c} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color: c, size }) => (
            <CircleUserRound size={size} color={c} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
