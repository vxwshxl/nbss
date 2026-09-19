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

/** Used as the User-Agent-ish marker on a position, so a trail can name its source. */
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
