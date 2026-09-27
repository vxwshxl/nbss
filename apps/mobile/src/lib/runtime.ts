import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/**
 * Which container the app is running in, and therefore what is missing.
 *
 * Expo Go is genuinely useful for this app — the sign-in, the duty screen, checking in
 * and out, raising an SOS and the realtime feed all work in it, which is most of the
 * product. But three things do not, and each of them fails *quietly*, which is the worst
 * possible way for a panic button's plumbing to fail. So the app detects the container
 * and says so on screen rather than letting somebody conclude from a silent test that
 * SOS works.
 *
 * What is unavailable in Expo Go, verified against the SDK 57 docs:
 *
 *   BACKGROUND LOCATION — neither platform. iOS: "You must use a development build to
 *   use background location since it is not supported in the Expo Go app." Android:
 *   "Foreground and background services are not available in Expo Go for Android."
 *   So the live map only updates while the app is open in front of you.
 *
 *   PUSH ON ANDROID — "Push notifications (remote notifications) functionality provided
 *   by expo-notifications is unavailable in Expo Go on Android from SDK 53." An SOS
 *   therefore never reaches an Android phone running Expo Go. iOS Expo Go still
 *   receives push.
 *
 *   MAPLIBRE — a third-party native module, so the map screen cannot render in Expo Go
 *   whenever it is built. It is only a config plugin today and nothing imports it, which
 *   is why the app boots in Expo Go at all.
 */
/**
 * react-native-web has no expo-notifications at all — the module's methods throw
 * "not available on web" rather than no-opping. The app ships as a native binary, but it
 * is also run through react-native-web to preview layouts in a desktop browser, and an
 * uncaught throw in the root layout makes every screen a red error page.
 */
export const IS_WEB = Platform.OS === "web";

export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** True where a real, OS-scheduled background location stream is possible. */
/**
 * True where a real, OS-scheduled background location stream is possible.
 *
 * False on the web deliberately, and it is worth stating why, because it is the single
 * fact that decides this product's iOS story: there is no background geolocation on the
 * web platform. `watchPosition` stops when the screen locks, on every browser, by design.
 * A guard therefore cannot be tracked from a PWA — which is why guards need the native
 * app and clients and supervisors do not.
 */
export const CAN_TRACK_IN_BACKGROUND = !IS_WEB && !IS_EXPO_GO;

/** True where a push sent by `drain_push_outbox` can actually be delivered. */
export const CAN_RECEIVE_PUSH = !IS_WEB && !(IS_EXPO_GO && Platform.OS === "android");

/**
 * The sentence shown on the duty screen when something important is switched off by the
 * container rather than by a setting the guard can change. Null when everything works.
 */
export function runtimeLimitation(): string | null {
  if (!IS_EXPO_GO) return null;

  return Platform.OS === "android"
    ? "Running in Expo Go. Your location is only shared while this screen is open, and SOS alerts from other guards will not reach this phone at all. Both need a development build."
    : "Running in Expo Go. Your location is only shared while this screen is open — background tracking needs a development build. Incoming SOS notifications do work.";
}
