import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the Supabase session is kept.
 *
 * AsyncStorage is the usual answer and is the wrong one here. It is a plain file
 * in the app's sandbox, and the value it would hold is a refresh token belonging
 * to somebody who can mark themselves present at a site — on a phone that is
 * handed between shifts and is far more likely to be lost than a laptop. This uses
 * the iOS keychain and Android's EncryptedSharedPreferences instead.
 *
 * The one complication is size. SecureStore warns above 2048 bytes per value, and
 * a Supabase session with a fat JWT goes past that. So a value is written in
 * chunks under numbered keys, with a small header recording how many there are.
 * Reassembly is exact; a partial write reads back as absent rather than as
 * corrupt, which makes the failure mode "sign in again" instead of "crash on
 * launch".
 */

const CHUNK_SIZE = 1800;

/**
 * The web fallback.
 *
 * `expo-secure-store` has no web implementation — there is no browser equivalent of the
 * iOS keychain. The app is shipped as a native binary, so this path is only reached when
 * it is run through react-native-web, which is done to preview and screenshot layouts on
 * a desktop browser.
 *
 * `localStorage` is plainly not secure storage, and that is acceptable only because this
 * path never reaches a guard's phone. It is guarded on `Platform.OS === "web"` rather
 * than on a build flag so there is no way for it to be the native path by accident.
 */
const webStorage = {
  getItem: (key: string) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private window, blocked storage */
    }
  },
  removeItem: (key: string) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* as above */
    }
  },
};

function chunkKey(key: string, index: number): string {
  return `${key}__${index}`;
}

/**
 * SecureStore keys must be alphanumeric, '.', '-' or '_'. Supabase's keys contain
 * a project ref and are fine today, but a future key with a colon in it would
 * throw at run time rather than fail a review, so it is normalised here.
 */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return webStorage.getItem(key);

    const base = safeKey(key);
    try {
      const header = await SecureStore.getItemAsync(base);
      if (header === null) return null;

      const count = Number(header);
      // Not a chunk header — an older single-value write, or a plain string.
      if (!Number.isInteger(count) || count < 1) return header;

      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await SecureStore.getItemAsync(chunkKey(base, i));
        // A missing chunk means the write was interrupted. Treated as no value at
        // all: half a session is worse than none, because it would fail somewhere
        // deep inside the auth client instead of at the sign-in screen.
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join("");
    } catch {
      // A keychain that cannot be read — a device in a strange state, a restore
      // from another phone — should present as signed out, not as a crash.
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return webStorage.setItem(key, value);

    const base = safeKey(key);
    // Cleared first, so shrinking a value cannot leave a longer previous one's
    // tail behind to be read back as part of the new one.
    await secureStorage.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    // Chunks before the header: if this is interrupted, the header is absent and
    // getItem reports nothing, rather than a header promising chunks that are not
    // there.
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(chunkKey(base, i), chunks[i] ?? "");
    }
    await SecureStore.setItemAsync(base, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") return webStorage.removeItem(key);

    const base = safeKey(key);
    const header = await SecureStore.getItemAsync(base).catch(() => null);
    const count = Number(header);

    if (Number.isInteger(count) && count > 0) {
      for (let i = 0; i < count; i += 1) {
        await SecureStore.deleteItemAsync(chunkKey(base, i)).catch(() => undefined);
      }
    }
    await SecureStore.deleteItemAsync(base).catch(() => undefined);
  },
};
