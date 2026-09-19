import { Redirect, Tabs } from "expo-router";

import { useAuth } from "@/lib/auth";
import { color } from "@/theme/tokens";

export default function ClientLayout() {
  const { session, role } = useAuth();

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && role !== "client") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerShadowVisible: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: { backgroundColor: color.background, borderTopColor: color.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        sceneStyle: { backgroundColor: color.appBg },
      }}
    >
      <Tabs.Screen name="site" options={{ title: "My sites" }} />
      <Tabs.Screen name="book" options={{ title: "Book guards" }} />
    </Tabs>
  );
}
