"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useState mirrored into localStorage, so a table's search, date range, sort
 * and page survive navigating away and coming back.
 *
 * The stored value is restored in an effect rather than in the initialiser.
 * That is deliberate: an initialiser that reads localStorage produces a first
 * client render different from the server's, which is exactly the hydration
 * mismatch that `src/lib/extension-noise.ts` exists to prevent elsewhere.
 *
 * Writing back is held off until one frame after the restore commits, so the
 * restored value is what gets persisted rather than the initial one racing
 * ahead of it and overwriting the saved state.
 *
 * Pass `key: undefined` to opt out and get a plain useState.
 */
export function usePersistentState<T>(key: string | undefined, initial: T) {
  const [state, setState] = useState<T>(initial);
  const ready = useRef(false);

  useEffect(() => {
    ready.current = false;

    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw != null) setState(JSON.parse(raw) as T);
      } catch {
        // Corrupt JSON, or storage blocked in a private window. Either way the
        // initial value is a perfectly good answer.
      }
    }

    const id = requestAnimationFrame(() => {
      ready.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [key]);

  useEffect(() => {
    if (!key || !ready.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage unavailable — not worth failing a render over.
    }
  }, [key, state]);

  return [state, setState] as const;
}
