// Registers the background location task. This import is the whole point of the line
// and must stay at the top: when the OS wakes the app in the background it starts the
// JavaScript runtime with no component tree, and a task defined inside a component
// would not exist yet. See src/lib/location-task.ts.
import "@/lib/location-task";

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  useFonts,
} from "@expo-google-fonts/geist";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth";
import { asSosPush, ensureChannels } from "@/lib/push";
import { color, font } from "@/theme/tokens";

// Held until Geist has loaded, so the first frame is not system-font text that then
// reflows into Geist — a jump the eye catches on every cold start.
void SplashScreen.preventAutoHideAsync();

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
  /**
   * Geist, the same family the website serves.
   *
   * Loaded as separate static weights because React Native cannot use the variable woff2
   * the web loads; `theme/tokens.ts` maps each weight to its own family name for the same
   * reason.
   */
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    // Hidden on an error too, deliberately. A missing font means the app falls back to
    // the system one, which is a cosmetic problem; holding the splash forever over it
    // would be a guard who cannot check in.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

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

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: color.background },
              headerTintColor: color.foreground,
              headerTitleStyle: { fontFamily: font.semibold },
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
