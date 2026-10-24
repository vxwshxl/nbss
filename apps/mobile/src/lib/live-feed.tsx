import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { EVENTS, guardChannel, siteChannel, type PositionBatch } from "@nbss/shared/realtime";

import { useAuth } from "./auth";
import { dutyAreas, type DutyAreas } from "./duty";
import { Notifications } from "./push";
import { supabase } from "./supabase";

/**
 * What the guard's maps and the SOS banner show — the duty areas, colleagues on duty
 * and open SOS — kept current by being told, not by asking.
 *
 * One socket (Supabase Realtime), two channels:
 *
 *   guard:<me>  — the database sends a small 'sos' message whenever an SOS this person
 *                 may see is raised, answered or closed (0033). One reload follows.
 *   site:<id>   — while checked in: the 15-second position batch for the site. The
 *                 colleagues' dots move from it directly, with no reload at all.
 *
 * Behind that, a reload when the app comes back to the front, when an SOS push lands,
 * and a slow one every two minutes in case the socket dropped without saying so. Before
 * this there were three separate timers (10, 20 and 20 seconds) each fetching the same
 * thing: the phone now makes a handful of requests an hour instead of hundreds.
 */
type Feed = {
  data: DutyAreas | undefined;
  /** Quietly, from a timer or an event. */
  reload: () => Promise<void>;
  /** For a pull-to-refresh: `refreshing` is true until it lands. */
  refresh: () => Promise<void>;
  refreshing: boolean;
};

const FeedContext = createContext<Feed | null>(null);

const FALLBACK_MS = 120_000;

export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const [data, setData] = useState<DutyAreas | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const next = await dutyAreas();
    if (alive.current) setData(next);
  }, []);

  // Several messages in a burst (an SOS raised, then answered) make one request.
  const reload = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    return new Promise<void>((resolve) => {
      pending.current = setTimeout(() => {
        pending.current = null;
        void load().finally(resolve);
      }, 250);
    });
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (alive.current) setRefreshing(false);
  }, [load]);

  // First load, the fallback timer, the app returning, and SOS pushes.
  useEffect(() => {
    alive.current = true;
    if (!me) return;
    void load();
    const t = setInterval(() => void load(), FALLBACK_MS);
    const app = AppState.addEventListener("change", (s) => s === "active" && void reload());
    const push = Notifications?.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { type?: string } | null)?.type === "sos") void reload();
    });
    return () => {
      alive.current = false;
      clearInterval(t);
      app.remove();
      push?.remove();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [me, load, reload]);

  // My own channel: told about every SOS I may see.
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(guardChannel(me), { config: { private: true } })
      .on("broadcast", { event: EVENTS.sos }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me, reload]);

  // My site's channel while checked in: colleagues move without a reload.
  const mySite = data?.areas.find((a) => a.mine && a.on_duty > 0)?.id ?? null;
  useEffect(() => {
    if (!mySite) return;
    const channel = supabase
      .channel(siteChannel(mySite), { config: { private: true } })
      .on("broadcast", { event: EVENTS.positions }, ({ payload }) => {
        const batch = payload as PositionBatch;
        const byGuard = new Map(batch.positions.map((p) => [p.guard_id, p]));
        setData((d) =>
          d && {
            ...d,
            friends: d.friends.map((f) => {
              const p = byGuard.get(f.id);
              return p ? { ...f, lat: p.lat, lng: p.lng, heading: p.heading, battery: p.battery ?? f.battery, inside: p.inside_fence, heard_at: p.received_at ?? f.heard_at } : f;
            }),
          },
        );
      })
      .on("broadcast", { event: EVENTS.sos }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mySite, reload]);

  const value = useMemo(() => ({ data, reload, refresh, refreshing }), [data, reload, refresh, refreshing]);
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

/** The feed where there is one (the guard app), or null (an SOS page opened by staff). */
export function useOptionalLiveFeed(): Feed | null {
  return useContext(FeedContext);
}

export function useLiveFeed(): Feed {
  const feed = useContext(FeedContext);
  if (!feed) throw new Error("useLiveFeed outside <LiveFeedProvider>");
  return feed;
}
