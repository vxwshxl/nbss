// Registers the background location task. This import is the whole point of the line
// and must stay at the top: when the OS wakes the app in the background it starts the
// JavaScript runtime with no component tree, and a task defined inside a component
// would not exist yet. See src/lib/location-task.ts.
import "@/lib/location-task";

import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth";
import { asSosPush, ensureChannels } from "@/lib/push";
import { color } from "@/theme/tokens";

/**
 * The root.
 *
 * Its one interesting job is routing an SOS from wherever the phone was to the alarm
 * screen, and there are two paths into that which behave differently:
 *
 *   TAPPED — `getLastNotificationResponse` covers the cold start, where the app was
 *   closed and the person tapped the notification to open it. Without it, the app
 *   launches to the duty screen and the emergency is a banner they have to find again.
 *
 *   ARRIVED — `addNotificationReceivedListener` covers the app already being open. It
 *   navigates without being asked, which is normally rude and is right here: an SOS is
 *   not a message to be read at leisure.
 */
export default function RootLayout() {
  useEffect(() => {
    void ensureChannels();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Cold start from a tapped notification.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      const sos = asSosPush(response.notification.request.content.data);
      if (sos) router.push(`/sos/${sos.alert_id}`);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const sos = asSosPush(response.notification.request.content.data);
      if (sos) router.push(`/sos/${sos.alert_id}`);
    });

    const arrived = Notifications.addNotificationReceivedListener((notification) => {
      const sos = asSosPush(notification.request.content.data);
      if (sos) router.push(`/sos/${sos.alert_id}`);
    });

    return () => {
      cancelled = true;
      tapped.remove();
      arrived.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: color.background },
              headerTintColor: color.foreground,
              headerTitleStyle: { fontWeight: "600" },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: color.appBg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(guard)" options={{ headerShown: false }} />
            <Stack.Screen name="(client)" options={{ headerShown: false }} />
            <Stack.Screen name="(staff)" options={{ headerShown: false }} />
            <Stack.Screen
              name="sos/[id]"
              options={{
                // Full screen, no header, and not dismissible by a swipe. An alarm
                // that can be flicked away by accident is not an alarm.
                presentation: "fullScreenModal",
                headerShown: false,
                gestureEnabled: false,
                animation: "fade",
              }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
