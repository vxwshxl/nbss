import { Redirect, Stack } from "expo-router";

import { Splash } from "@/components/splash";
import { useAuth } from "@/lib/auth";
import { color } from "@/theme/tokens";

/** Nothing to ask someone who is already through the door. */
export default function AuthLayout() {
  const { session, profile } = useAuth();

  if (session === undefined) return <Splash />;
  if (session && profile) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.appBg },
      }}
    >
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}
