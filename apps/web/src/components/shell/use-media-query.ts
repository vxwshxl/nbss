"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a media query.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the value is read
 * during render from the source of truth, so there is no frame where the tree
 * has mounted with the wrong answer. The server snapshot is the caller's
 * `serverFallback` — a media query has no meaning without a viewport, and
 * guessing "false" there would render every shell as a phone and then reflow.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}
