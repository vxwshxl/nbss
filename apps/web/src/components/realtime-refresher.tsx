"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { tablesForRoute } from "@/lib/realtime/routes";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** If the live connection is down, how often a visible page re-reads itself. */
const FALLBACK_MS = 3 * 60_000;
/** Coming back to a tab refreshes it if it has been this long. */
const RETURN_STALE_MS = 30_000;
/** Quiet period after the last change before refreshing (a roster save is a burst). */
const SETTLE_MS = 700;
/** …but never hold a refresh longer than this while changes keep arriving. */
const MAX_WAIT_MS = 3000;

function isEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.closest("[role=dialog]")) return true;
  return (
    el.isContentEditable ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    (el.tagName === "INPUT" &&
      !["button", "submit", "checkbox", "radio", "range"].includes((el as HTMLInputElement).type))
  );
}

/**
 * Live updates, without the lag.
 *
 * One Supabase Realtime channel carries the database's change feed over a
 * websocket held by Supabase — no polling, and no load on our server until
 * something actually changes. A change is only a signal: the page re-reads
 * itself with `router.refresh()`, and React keeps everything on screen until
 * the new rows arrive, so nothing blanks or jumps.
 *
 * Postgres changes are filtered by each subscriber's RLS, so a guard's browser
 * only ever hears about rows that guard may read.
 *
 * What keeps it fast:
 *  - A change refreshes the page only if that page shows the table.
 *  - Bursts collapse into one refresh (settle 0.7 s, at most every 3 s).
 *  - Nothing refreshes in a hidden tab, or while someone is typing or has a
 *    dialog open — it waits for the tab to come back or the field to blur.
 *  - Changes to a page you're not on are remembered and applied on arrival.
 */
export function RealtimeRefresher({
  tables,
  clientTopic,
}: {
  tables: readonly string[];
  /**
   * A client's private doorbell (`client:<id>`, migration 0010). Clients have
   * no RLS read on attendance, so change events never reach them; this does.
   */
  clientTopic?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const dirty = useRef(new Set<string>());
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstAt = useRef<number | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
    const wanted = tablesForRoute(pathname);
    if (wanted === "off") return;
    if (wanted.some((t) => dirty.current.has(t))) {
      for (const t of wanted) dirty.current.delete(t);
      router.refresh();
    }
  }, [pathname, router]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase.channel("console-realtime");
    let live = false;
    let cancelled = false;
    let lastRefresh = Date.now();

    const flush = () => {
      timer.current = null;
      firstAt.current = null;
      if (!pending.current || document.hidden || isEditing()) return;
      pending.current = false;
      lastRefresh = Date.now();
      router.refresh();
    };

    const schedule = () => {
      const now = Date.now();
      firstAt.current ??= now;
      if (timer.current) clearTimeout(timer.current);
      const wait = Math.min(SETTLE_MS, Math.max(0, MAX_WAIT_MS - (now - firstAt.current)));
      timer.current = setTimeout(flush, wait);
    };

    const onChange = (table: string) => () => {
      const wanted = tablesForRoute(pathRef.current);
      if (wanted === "off" || !wanted.includes(table)) {
        dirty.current.add(table);
        return;
      }
      pending.current = true;
      schedule();
    };

    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange(table));
    }


    // The socket must join as the signed-in person, or RLS sees an anonymous
    // subscriber and filters out every event. The browser client reads its
    // session from the cookie asynchronously, and a join sent before that
    // finishes carries no user token — so the session is resolved first and
    // handed to Realtime explicitly, and kept current as tokens refresh.
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
    });

    const doorbell = clientTopic
      ? supabase
          .channel(clientTopic, { config: { private: true } })
          .on("broadcast", { event: "attendance" }, onChange("attendance"))
      : null;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe((status) => {
        live = status === "SUBSCRIBED";
      });
      doorbell?.subscribe();
    });

    const refreshIfIdle = () => {
      const wanted = tablesForRoute(pathRef.current);
      if (wanted === "off" || wanted.length === 0 || document.hidden || isEditing()) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const fallback = setInterval(() => {
      if (!live) refreshIfIdle();
    }, FALLBACK_MS);

    const resume = () => {
      if (pending.current && !timer.current) schedule();
    };
    const onVisible = () => {
      if (document.hidden) return;
      resume();
      if (!live && Date.now() - lastRefresh > RETURN_STALE_MS) refreshIfIdle();
    };
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("focusout", resume);

    return () => {
      cancelled = true;
      auth.subscription.unsubscribe();
      clearInterval(fallback);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("focusout", resume);
      void supabase.removeChannel(channel);
      if (doorbell) void supabase.removeChannel(doorbell);
    };
  }, [router, tables, clientTopic]);

  return null;
}
