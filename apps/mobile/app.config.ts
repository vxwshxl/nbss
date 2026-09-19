import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * A dynamic config rather than app.json, for one reason: it can read the shared
 * .env at the repository root.
 *
 * There is exactly one .env in this repository, symlinked into each app by
 * `pnpm env:link`. Expo loads it when this file is evaluated, so the Supabase
 * details are read here under the names the web app already uses and passed into
 * `extra` — rather than duplicated as EXPO_PUBLIC_* copies that would then have to
 * be rotated twice. `src/lib/config.ts` reads them back out.
 *
 * Both values are safe to ship in a manifest. The URL is public, and the
 * publishable key is subject to row level security — which 0004 through 0007 are
 * what make true. The secret key is never read here and must never be.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "NBSS Operations",
  slug: "nbss-operations",
  scheme: "nbss",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",

  ios: {
    bundleIdentifier: "in.co.nbss.ops",
    supportsTablet: false,
    infoPlist: {
      /**
       * Two strings, and iOS shows them at different moments. The "when in use"
       * prompt comes first; the "always" prompt comes later, and Apple will reject
       * a build whose wording does not explain why background access is needed.
       * Both say the same honest thing: tracking follows the shift.
       */
      NSLocationWhenInUseUsageDescription:
        "Your location is checked against your site's boundary so you can mark yourself present, and is shared with the control room while you are on duty.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "While you are checked in, your location is shared with the control room so supervisors can see the site is covered and reach you if you raise an SOS. It stops the moment you check out.",
      NSLocationAlwaysUsageDescription:
        "While you are checked in, your location is shared with the control room. It stops the moment you check out.",
      NSCameraUsageDescription:
        "Used for the optional photograph taken when you check in, which is what makes a check-in hard to fake.",

      UIBackgroundModes: ["location", "remote-notification", "fetch"],

      // An SOS must be able to break through Focus and Do Not Disturb. Time
      // Sensitive is the entitlement Apple grants for this; Critical Alerts needs a
      // separate application and is not assumed here.
      NSUserNotificationsUsageDescription:
        "SOS alerts from your site are delivered as time-sensitive notifications so they are not silenced.",
    },
    entitlements: {
      "com.apple.developer.usernotifications.time-sensitive": true,
    },
  },

  android: {
    package: "in.co.nbss.ops",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      // The one that makes tracking survive the screen going off. Android 11+
      // grants it only from the system settings screen, never from a dialog, so
      // the app has to walk the guard there — see src/lib/location.ts.
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
      // Lets the SOS alarm screen wake a dark phone rather than waiting for
      // someone to pick it up.
      "WAKE_LOCK",
      "VIBRATE",
      "RECEIVE_BOOT_COMPLETED",
    ],
  },

  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        // The console's app background, not white — so a cold start does not flash a
        // brighter screen than the one it is about to show.
        backgroundColor: "#f3f4f5",
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "While you are checked in, your location is shared with the control room so supervisors can see the site is covered and reach you if you raise an SOS. It stops the moment you check out.",
        /**
         * Both of these are required for a trail that survives the app being
         * backgrounded. Without the foreground service, Android kills the task
         * within minutes and the map quietly goes stale — which looks exactly like
         * a guard who has gone home.
         */
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#B91C1C",
        // Bundled rather than fetched, because the alarm has to be audible on a
        // phone that has just been handed a push with no network left.
        sounds: [],
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          // MapLibre's native library needs 16 KB page alignment on Android 15+,
          // and a recent NDK to build against.
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
        ios: {
          deploymentTarget: "16.4",
          // MapLibre ships as a dynamic framework.
          useFrameworks: "static",
        },
      },
    ],
    "expo-secure-store",
    "expo-task-manager",
    // Vector maps, and no API key anywhere. MapLibre renders whatever style it is
    // given: today the console's own /api/tiles proxy as a raster source, and the
    // same Protomaps PMTiles on R2 once those are generated — the app does not
    // change either way, only the style URL does.
    "@maplibre/maplibre-react-native",
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    supabaseUrl: SUPABASE_URL,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
    // Filled in by `eas init`. Left absent rather than guessed, because a wrong
    // projectId makes push tokens silently belong to somebody else's project.
    eas: (config.extra as { eas?: unknown } | undefined)?.eas,
  },
});
