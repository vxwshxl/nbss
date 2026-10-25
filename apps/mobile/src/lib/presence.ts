import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "./auth";
import { supabase } from "./supabase";

/**
 * "Last seen" for the console: stamped when the app opens signed in and each time it
 * comes back to the front. The database writes at most once a minute (0048), so this
 * costs nothing on a phone that is switched to and from all day.
 */
export function usePresence(): void {
  const { session } = useAuth();
  const me = session?.user.id ?? null;

  useEffect(() => {
    if (!me) return;
    const touch = () => void supabase.rpc("touch_presence").then(() => undefined, () => undefined);
    touch();
    const sub = AppState.addEventListener("change", (s) => s === "active" && touch());
    return () => sub.remove();
  }, [me]);
}
