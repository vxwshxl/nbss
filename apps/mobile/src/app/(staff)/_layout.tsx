import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/lib/auth";
import { registerForPush } from "@/lib/push";
import { color } from "@/theme/tokens";

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

  useEffect(() => {
    if (!session) return;
    void registerForPush();
  }, [session]);

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (role && role !== "admin" && role !== "supervisor") return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        // The same topbar the guard and client tabs carry, so all three roles get the
        // console's chrome rather than two of them getting it and one a plain title bar.
        header: () => <TopBar role={role ?? "supervisor"} name={profile?.full_name ?? "—"} />,
        contentStyle: { backgroundColor: color.appBg },
      }}
    >
      <Stack.Screen name="live" />
    </Stack>
  );
}
