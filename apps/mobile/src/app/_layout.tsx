// Registers the background location task. This import is the whole point of the line
// and must stay at the top: when the OS wakes the app in the background it starts the
// JavaScript runtime with no component tree, and a task defined inside a component
// would not exist yet. See src/lib/location-task.ts.
import "@/lib/location-task";
// The background push handler, for the same reason: the watchdog's wake arrives
// with no component tree. See src/lib/push-task.ts.
import "@/lib/push-task";

import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/geist";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth";
import { DataModeProvider } from "@/lib/data-mode";
import { usePresence } from "@/lib/presence";
import { ensureChannels } from "@/lib/push";
import { color, font } from "@/theme/tokens";
import type { ErrorBoundaryProps } from "expo-router";
import { ErrorScreen } from "@/components/error-screen";
import { UpdateGate } from "@/components/update-screen";
import { NotificationRouter } from "@/lib/notification-router";
import { preloadBrandMark } from "@/components/brand-mark";
import { LogBox } from "react-native";
import { IS_EXPO_GO } from "@/lib/runtime";

// Expo Go's own notices about push being limited there: true, expected, and not this
// app's to fix (the installed build has full push). Kept out of the in-app warning
// overlay so a real warning is not lost among them.
if (IS_EXPO_GO) {
  LogBox.ignoreLogs([
    "expo-notifications: Android Push notifications",
    "`expo-notifications` functionality is not fully supported in Expo Go",
  ]);
}

// Held until Geist has loaded, so the first frame is not system-font text that then
// reflows into Geist — a jump the eye catches on every cold start.
void SplashScreen.preventAutoHideAsync();

/**
 * The root: fonts, providers and the stack. Following a tapped notification to its
 * screen (an SOS to the alarm, a duty to its shift) is NotificationRouter's job
 * (lib/notification-router.tsx): it waits until the navigator and the sign-in are
 * ready, because navigating before then left the app on a white screen.
 */
/** A screen that throws shows this in its place, with a retry, instead of a red box or a blank app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen code={500} onRetry={() => void retry()} detail={__DEV__ ? error.message : undefined} />;
}

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
    Geist_800ExtraBold,
  });

  // The logo the loading screen shows, cached first so it is there on the first frame.
  const [markReady, setMarkReady] = useState(false);
  useEffect(() => {
    void preloadBrandMark().then(() => setMarkReady(true));
  }, []);

  useEffect(() => {
    // Hidden on an error too, deliberately. A missing font means the app falls back to
    // the system one, which is a cosmetic problem; holding the splash forever over it
    // would be a guard who cannot check in.
    if ((fontsLoaded || fontError) && markReady) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, markReady]);

  useEffect(() => {
    void ensureChannels();
  }, []);

  if ((!fontsLoaded && !fontError) || !markReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Presence />
          {/* Keyed by Test / Live: a developer's switch starts every screen again on that side. */}
          <DataModeProvider>
            {(mode) => (
              <Stack
                key={mode}
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
                <Stack.Screen name="assistant" options={{ headerShown: false, presentation: "modal" }} />
                <Stack.Screen name="shift/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
                <Stack.Screen name="person/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
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
            )}
          </DataModeProvider>
          <NotificationRouter />
          {/* Over every screen, signed in or not, when the office has published a newer build. */}
          <UpdateGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Stamps "last seen" for the console (lib/presence.ts). Inside the auth provider. */
function Presence() {
  usePresence();
  return null;
}
