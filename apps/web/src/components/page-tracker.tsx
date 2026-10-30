"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SEEN = "nbss-visitor";
/** Fired with the page-view count after each counted view (the footer's VisitorCount listens). */
export const VIEWS_EVENT = "nbss:views";

/**
 * Counts a page view on every real navigation (migration 0071, /api/track). An effect never
 * runs on a prefetch, so only pages people open are counted. The first visit from a browser
 * also counts a visitor (remembered in localStorage).
 */
export function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    let first = false;
    try {
      first = !localStorage.getItem(SEEN);
      if (first) localStorage.setItem(SEEN, new Date().toISOString());
    } catch {}
    fetch("/api/track", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: pathname, first }) })
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((d: { views?: number } | null) => {
        if (d?.views != null) window.dispatchEvent(new CustomEvent(VIEWS_EVENT, { detail: Number(d.views) }));
      })
      .catch(() => {});
  }, [pathname]);
  return null;
}
