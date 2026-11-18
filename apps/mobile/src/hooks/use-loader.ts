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
 *
 * A NEW FETCHER LOADS AGAIN. Screens pass a `useCallback` that closes over what they
 * show (the day, the period, the person), so a new fetcher means a new question: it is
 * asked at once, the old answer is dropped (data goes back to `undefined`, so the screen
 * shows it is loading rather than yesterday's list under "Tomorrow"), and an answer to an
 * older question that arrives late is ignored. Until this, only the first fetcher was
 * ever asked: switching Yesterday / Today / Tomorrow changed the title and nothing else.
 * The fetcher must therefore be memoised (`useCallback`), as every caller's is.
 */
export function useLoader<T>(fetcher: () => Promise<T>): {
  data: T | undefined;
  /** True only for a user-initiated refresh, so a pull-to-refresh spinner is honest. */
  refreshing: boolean;
  error: string | null;
  /** Loads again quietly (timers, focus, realtime). */
  reload: () => Promise<void>;
  /** Loads again with the pull-to-refresh spinner showing. */
  refresh: () => Promise<void>;
} {
  // The answer, with the fetcher that gave it: an answer to an older question is not
  // this screen's data any more.
  const [answer, setAnswer] = useState<{ from: () => Promise<T>; value: T } | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The newest fetcher, for reload/refresh and for telling a late answer from a current
  // one. Written in an effect, never during render (the compiler's refs rule).
  const fetcherRef = useRef(fetcher);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (spinner: boolean) => {
    const asked = fetcherRef.current;
    if (spinner) setRefreshing(true);
    try {
      const value = await asked();
      // Only the newest question's answer is kept.
      if (mounted.current && asked === fetcherRef.current) {
        setAnswer({ from: asked, value });
        setError(null);
      }
    } catch (e) {
      if (mounted.current && asked === fetcherRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (spinner && mounted.current) setRefreshing(false);
    }
  }, []);

  // On mount, and whenever the screen asks something new. The state is set when the
  // answer comes back, not in the effect body.
  useEffect(() => {
    fetcherRef.current = fetcher;
    fetcher()
      .then((value) => {
        if (mounted.current && fetcher === fetcherRef.current) {
          setAnswer({ from: fetcher, value });
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (mounted.current && fetcher === fetcherRef.current) setError(e instanceof Error ? e.message : String(e));
      });
  }, [fetcher]);

  /**
   * Two ways to load again, and the difference is the spinner. `reload` is silent:
   * timers, focus and realtime use it, and a pull-to-refresh spinner flashing every
   * ten seconds on its own (as it did) reads as the app glitching. `refresh` is for
   * the pull itself, and shows the spinner until the answer is in.
   */
  const reload = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

  return { data: answer && answer.from === fetcher ? answer.value : undefined, refreshing, error, reload, refresh };
}
