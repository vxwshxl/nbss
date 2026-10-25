import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { supabase } from "@/lib/supabase";

type Table = "attendance" | "shifts" | "sites" | "profiles" | "sos_alerts" | "site_postings" | "replacement_requests" | "guard_devices";

let seq = 0;

/**
 * Keeps a staff screen current the way the console's pages are kept: told by the
 * database whenever one of its tables changes (a check-in on the website, a guard
 * posted from the console, an SOS answered), then one quiet reload.
 *
 * Only while the screen is in front: a tab in the background holds no subscription,
 * so the phone is not woken for screens nobody is looking at. Coming back to the
 * screen, or the app returning from the background (when the socket may have
 * dropped), reloads once, so nothing missed while away stays missed.
 */
export function useLiveTables(tables: readonly Table[], reload: () => unknown): void {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  }, [reload]);
  const key = tables.join(",");

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      // A burst of changes (a roster saved, ten shifts at once) makes one request.
      const soon = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void latest.current(), 400);
      };
      void latest.current();
      let channel = supabase.channel(`screen:${key}:${++seq}`);
      for (const table of key.split(",")) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, soon);
      }
      channel.subscribe();
      const app = AppState.addEventListener("change", (s) => s === "active" && soon());
      return () => {
        if (timer) clearTimeout(timer);
        app.remove();
        void supabase.removeChannel(channel);
      };
    }, [key]),
  );
}
