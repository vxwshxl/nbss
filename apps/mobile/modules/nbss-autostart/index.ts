import { requireOptionalNativeModule } from "expo";

/** The Android side of Autostart (Xiaomi, Vivo, Oppo and the rest). Null on iOS, web and Expo Go. */
type NbssAutostart = {
  /** The switch itself, on Xiaomi, Redmi and POCO; "unknown" elsewhere. */
  miuiAutostart(): "on" | "off" | "unknown";
  /** When the phone last started, and when the app last started by itself at a phone start (0: never). Epoch ms. */
  bootState(): { bootAt: number; seenAt: number };
  /** Opens the brand's Autostart screen; false when it fell back to the app's settings. */
  openAutostartSettings(): boolean;
};

export default requireOptionalNativeModule<NbssAutostart>("NbssAutostart");
