import { useEffect, useState } from "react";

/**
 * The current time, as state that ticks.
 *
 * Calling `Date.now()` during render is what the React Compiler's purity rule objects to,
 * and behind the objection is a real bug rather than a technicality. The live screen ages
 * every guard's position against "now" to decide whether they are live, going stale, or
 * out of contact — computed during render, that only changed when a new batch of positions
 * arrived. A guard whose phone had died sent no batch, so nothing re-rendered, so they sat
 * on the map showing "Live" indefinitely. Exactly backwards: the one case the freshness
 * indicator exists for was the one it could not detect.
 *
 * Ticking makes the clock an input that changes on its own, so a dot goes amber on its own.
 *
 * The default interval is 10s rather than 1s: the thresholds this feeds are measured in
 * minutes (`STALE_AFTER_MS` is six), so a second-by-second re-render would be a hundred
 * wasted passes for the same answer.
 */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
