"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

/**
 * Most "This page did not load" screens were never a broken page. They were a page
 * caught mid-deploy (the site is replaced while it is being read, or a tab still holds
 * the previous version's scripts), a restart that took a few seconds, or a request lost
 * on a weak connection. Each of those comes right on its own a moment later, and
 * showing an error for it only teaches people the site is unreliable.
 *
 * So an error boundary heals first and admits defeat last:
 *   - a stale version (a script chunk that no longer exists, a server action from the
 *     previous build): reload the page once, which fetches the current version;
 *   - anything else: re-read the page from the server quietly, up to three times,
 *     1.5 s, 3 s and 6 s apart;
 *   - only if all of that fails is the error shown, with Try again.
 *
 * Attempts are counted per page in sessionStorage, so a page that is truly broken shows
 * its error after the retries instead of reloading for ever.
 *
 * Returns true while it is still trying, for the boundary to show a quiet placeholder.
 */
const DELAYS = [1500, 3000, 6000];
const WINDOW_MS = 60_000;

function staleBuild(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Failed to find Server Action|older or newer deployment|Importing a module script failed/i.test(text);
}

function attempts(key: string): number {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const { n, at } = JSON.parse(raw) as { n: number; at: number };
    return Date.now() - at < WINDOW_MS ? n : 0;
  } catch {
    return 0;
  }
}

function record(key: string, n: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ n, at: Date.now() }));
  } catch {
    // Private mode without storage: the retries still run, just not remembered.
  }
}

export function useSelfHeal(error: Error & { digest?: string }, reset: () => void): boolean {
  const router = useRouter();
  const [key] = useState(() => (typeof window === "undefined" ? "heal:" : `heal:${window.location.pathname}`));
  const [trying, setTrying] = useState(() => (typeof window === "undefined" ? true : attempts(key) < DELAYS.length));

  useEffect(() => {
    console.error(error);
    const n = attempts(key);

    if (staleBuild(error)) {
      if (n === 0) {
        record(key, 1);
        window.location.reload();
        return;
      }
    }

    if (n >= DELAYS.length) {
      // Out of retries: show the error (from a timer, as the error can arrive again
      // on the same boundary after a retry).
      const give = window.setTimeout(() => setTrying(false), 0);
      return () => window.clearTimeout(give);
    }
    const timer = window.setTimeout(() => {
      record(key, n + 1);
      startTransition(() => {
        router.refresh();
        reset();
      });
    }, DELAYS[n]);
    return () => window.clearTimeout(timer);
  }, [error, key, reset, router]);

  return trying;
}
