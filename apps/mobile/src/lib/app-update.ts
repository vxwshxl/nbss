import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { APP_BUILD } from "./config";
import { supabase } from "./supabase";

export type AppRelease = {
  version_code: number;
  version_name: string | null;
  store_url: string | null;
  notes: string | null;
};

/**
 * The newer release this phone should install, or null.
 *
 * The office publishes the latest build in the console (App updates). It is read at
 * launch and whenever the app comes back to the front, so a release published while
 * the app sat in the background is noticed on the next look. Expo Go and the browser
 * preview have no build number and are never asked.
 *
 * "Later" hides it until the app is next started.
 */
/** The published release when it is newer than this build and has a link, else null. */
async function newerRelease(): Promise<AppRelease | null> {
  if (!APP_BUILD) return null;
  const { data } = await supabase
    .from("app_release")
    .select("version_code, version_name, store_url, notes")
    .eq("id", 1)
    .maybeSingle();
  // No link, nowhere to send anyone: the screen only shows when it can help.
  return data && data.store_url && data.version_code > APP_BUILD ? data : null;
}

export function useAppUpdate(): { release: AppRelease | null; later: () => void } {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const load = () => {
      newerRelease()
        .then(setRelease)
        .catch(() => undefined);
    };
    load();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => sub.remove();
  }, []);

  return { release: dismissed ? null : release, later: () => setDismissed(true) };
}
