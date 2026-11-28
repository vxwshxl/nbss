import * as Location from "expo-location";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth";
import { onDutyChanged, openPunch } from "@/lib/duty";
import { feedLocations } from "@/lib/location-task";
import { IS_WEB } from "@/lib/runtime";

/**
 * A supervisor's or field officer's own position while they are checked in and the
 * app is open, in the staff app (0082).
 *
 * The guard's Duty screen feeds its fixes into the outbox itself while it is open;
 * the staff app had nothing like it. So a supervisor or field officer whose phone
 * allows location only "while using the app" (or Expo Go, which has no background
 * location at all) checked in and then sent nothing: "Last heard never" on the
 * live map. This follows the phone while the app is in front and the person is on
 * duty, whatever tab is open, through the same outbox and spacing policy as the
 * background stream, so a point is never sent twice. It stops at check-out and when
 * the app goes to the background (where the background task, if allowed, takes over).
 *
 * Rendered once, in the staff layout. Renders nothing.
 */
export function OnDutyFeed() {
  const { role } = useAuth();
  const fieldStaff = role === "supervisor" || role === "field_officer";

  useEffect(() => {
    if (!fieldStaff || IS_WEB) return;
    let sub: Location.LocationSubscription | null = null;
    let busy = false;
    let gone = false;

    const stop = () => {
      sub?.remove();
      sub = null;
    };

    const check = async () => {
      if (busy || gone) return;
      busy = true;
      try {
        const active = AppState.currentState === "active";
        const punch = active ? await openPunch() : null;
        if (gone) return;
        if (!punch) return stop();
        if (sub) return;
        const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
        if (!permission?.granted || gone) return;
        const watch = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5_000 },
          (p) =>
            void feedLocations([
              {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracyM: p.coords.accuracy ?? 9999,
                heading: p.coords.heading,
                speed: p.coords.speed,
                at: p.timestamp,
              },
            ]).catch(() => undefined),
        ).catch(() => null);
        if (gone) watch?.remove();
        else sub = watch;
      } finally {
        busy = false;
      }
    };

    void check();
    // Checked out elsewhere (the website, a supervisor, the automatic check-out): noticed within a minute.
    const poll = setInterval(() => void check(), 60_000);
    const app = AppState.addEventListener("change", () => void check());
    const off = onDutyChanged(() => void check());
    return () => {
      gone = true;
      clearInterval(poll);
      app.remove();
      off();
      stop();
    };
  }, [fieldStaff]);

  return null;
}
