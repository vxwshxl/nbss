import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Load something once on mount, and again on a pull-to-refresh.
 *
 * Every screen here was doing this by hand, and all of them had the same two faults.
 *
 *   THEY SET STATE AFTER UNMOUNTING. A guard who opens the duty screen and switches tab
 *   before the query returns left a `setState` landing on a component that had gone. React
 *   no longer warns about it, which makes it quieter rather than better.
 *
 *   THE SET HAPPENED IN THE EFFECT BODY. `useEffect(() => { void load(); })` where `load`
 *   itself calls `setState` is what the React Compiler's `set-state-in-effect` rule
 *   objects to, and it is right to: it schedules a second render pass on every mount.
 *   Here the state is set inside the promise's callback instead — the resolution of the
 *   query is the external event, which is the shape an effect is actually meant to have.
 *
 * `data` is `undefined` until the first load finishes, which is deliberately distinct from
 * a load that finished and found nothing. Screens use it to show a spinner rather than
 * flashing an empty state at somebody whose data is a few hundred milliseconds away.
 */
export function useLoader<T>(fetcher: () => Promise<T>): {
  data: T | undefined;
  /** True only for a user-initiated refresh, so a pull-to-refresh spinner is honest. */
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The fetcher is held in a ref rather than listed as a dependency.
   *
   * Screens declare it with `useCallback`, but the moment one closes over a piece of state
   * the identity changes on every render and the effect below would re-run forever. The
   * ref keeps the newest one reachable without making it a trigger.
   */
  const fetcherRef = useRef(fetcher);

  // Synced in an effect, not assigned during render. Writing a ref while rendering is what
  // the compiler's "Cannot access refs during render" rule forbids, and it is right to:
  // a render can be thrown away and re-run, so a write during one is not guaranteed to
  // have happened once. `useRef(fetcher)` already holds the first one, and the mount
  // effect below runs after this, so nothing is stale on the initial load.
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    fetcherRef
      .current()
      .then((result) => {
        if (mounted.current) setData(result);
      })
      .catch((e: unknown) => {
        if (mounted.current) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  return { data, refreshing, error, reload };
}
