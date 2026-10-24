import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export type LiveFix = { lat: number; lng: number; accuracyM: number; at: number };

export type LivePosition = {
  fix: LiveFix | null;
  /**
   * Which way the phone is pointing, degrees from north: the compass while the
   * screen is open (like Google Maps' blue beam), null when it cannot tell.
   */
  heading: number | null;
  /** "denied" when the app may not read the location, "off" when GPS itself is off. */
  problem: "denied" | "off" | null;
  /** Asks again, for the button on the "allow location" notice. */
  retry: () => void;
};

/**
 * The phone's position, followed while the screen is in front of the guard.
 *
 * Only while it is focused: the watch stops the moment they switch tab or lock
 * the phone. The shift itself is tracked by the background task, not by this —
 * this is only the blue dot.
 */
export function useLivePosition(): LivePosition {
  const [fix, setFix] = useState<LiveFix | null>(null);
  const [problem, setProblem] = useState<LivePosition["problem"]>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let sub: Location.LocationSubscription | null = null;
      let compass: Location.LocationSubscription | null = null;
      let gone = false;

      void (async () => {
        if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
          if (!gone) setProblem("off");
          return;
        }
        // Only the while-in-use permission; the background one is asked for at check-in.
        const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (!permission?.granted) {
          if (!gone) setProblem("denied");
          return;
        }
        if (!gone) setProblem(null);

        const onFix = (p: Location.LocationObject) => {
          if (gone) return;
          setFix({
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracyM: p.coords.accuracy ?? Number.POSITIVE_INFINITY,
            at: p.timestamp,
          });
        };

        // A quick first dot from the last known fix, then the real stream.
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
        if (last) onFix(last);

        const watch = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 3_000 },
          onFix,
        ).catch(() => null);
        if (gone) watch?.remove();
        else sub = watch;

        // The compass, only while this screen is in front: it is cheap, and it is
        // what lets the guard see which way they are facing. Rounded to 5° so a
        // hand's tremor does not re-render the map thirty times a second.
        const turn = await Location.watchHeadingAsync((h) => {
          if (gone) return;
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0 && h.accuracy !== 0) setHeading((prev) => (prev !== null && Math.abs(prev - deg) < 5 ? prev : Math.round(deg / 5) * 5));
        }).catch(() => null);
        if (gone) turn?.remove();
        else compass = turn;
      })();

      return () => {
        gone = true;
        sub?.remove();
        compass?.remove();
      };
      // `attempt` is only a trigger: bumping it re-runs the watch after a retry.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]),
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { fix, heading, problem, retry };
}
