import Constants from "expo-constants";

/**
 * The two values the app cannot work without, read back out of the manifest that
 * app.config.ts put them into.
 *
 * Thrown rather than defaulted. A build that shipped without a Supabase URL
 * should fail at the first screen with a sentence explaining why, not sign
 * somebody in against nothing and produce a blank duty screen at a gate.
 */
function required(name: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `${name} is missing from the app config. Run \`pnpm env:link\` at the repository root so apps/mobile/.env points at the shared .env, then restart the bundler.`,
    );
  }
  return value;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export const SUPABASE_URL = required("supabaseUrl", extra.supabaseUrl);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "supabasePublishableKey",
  extra.supabasePublishableKey,
);

/**
 * The website, for the sign-in endpoints and the assistant. Empty when not configured.
 *
 * In development the .env says `http://localhost:3000`, which on a phone means the
 * phone itself. When that is the case and the app was loaded from a dev server
 * (Expo Go or a dev build), the computer's address that Expo already knows
 * (`hostUri`, e.g. 192.168.1.20:8081) is put in its place, keeping the website's
 * port. A real address (https://…) is left exactly as it is.
 */
function webUrl(): string {
  const raw = typeof extra.webUrl === "string" ? extra.webUrl.replace(/\/+$/, "") : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
    if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && devHost && devHost !== "localhost") {
      url.hostname = devHost;
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    // Not a URL we can read: use it as given.
  }
  return raw;
}

export const WEB_URL = webUrl();

/** Used as the User-Agent-ish marker on a position, so a trail can name its source. */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
