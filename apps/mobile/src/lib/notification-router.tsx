import { router, usePathname, useRootNavigationState, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "./auth";
import { ensureTracking } from "./keep-alive";
import { Notifications } from "./push";

type Role = "developer" | "admin" | "supervisor" | "guard" | "client";
type Push = { type: string; alert_id?: string; shift_id?: string; audience?: string };

/**
 * The notification's own fields, wherever the platform put them. Tapped from a closed
 * app, Android can hand them over nested ("data", "body", a JSON string…) rather than
 * at the top, and reading only the top is how a tap opened nothing.
 */
function pushOf(raw: unknown, depth = 0): Push | null {
  if (!raw || depth > 4) return null;
  if (typeof raw === "string") {
    try {
      return pushOf(JSON.parse(raw), depth + 1);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type === "string") return o as unknown as Push;
  for (const key of ["data", "dataString", "body", "notification", "request", "content", "trigger", "remoteMessage"]) {
    const found = pushOf(o[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/** Where a tapped notification leads, for this person. Null: just open the app. */
function targetFor(p: Push, role: Role): Href | null {
  const staff = role === "developer" || role === "admin" || role === "supervisor";
  if (p.type === "sos" && p.alert_id) {
    // A guard's SOS lives in their SOS tab; the office and clients get the alert's own page.
    return role === "guard" && p.audience === "on_duty_guard" ? "/(guard)/alerts" : `/sos/${p.alert_id}`;
  }
  if (role === "guard") {
    if (p.type === "duty" && p.shift_id) return { pathname: "/shift/[id]", params: { id: p.shift_id } };
    if (p.type === "duty" || p.type === "replacement") return "/(guard)/duties";
    if (p.type === "check_in" || p.type === "check_out" || p.type === "resume_tracking") return "/(guard)/duty";
    return null;
  }
  if (staff) {
    if (["silent_guard", "device", "check_in", "check_out"].includes(p.type)) return "/(staff)/live";
    if (p.type === "duty" || p.type === "replacement") return "/(staff)/today";
    return null;
  }
  if (role === "client" && (p.type === "check_in" || p.type === "check_out")) return "/(client)/site";
  return null;
}

/**
 * Opens the screen a tapped notification is about.
 *
 * The tap is held until the app can actually go somewhere: the navigator is mounted,
 * the sign-in has been read from storage, and the launch has already landed on the
 * person's home tab. Navigating any earlier — on the first frame of a cold start, while
 * the root is still waiting for its fonts — is what left a tap on a white screen, and
 * the launch's own redirect home would otherwise run over it.
 *
 * Inside the auth provider, below the navigator.
 */
export function NotificationRouter() {
  const { session, role } = useAuth();
  const nav = useRootNavigationState();
  const pathname = usePathname();
  // The tap waiting to be followed, and a counter that wakes the effect below when one arrives.
  const pending = useRef<Push | null>(null);
  const [arrivedAt, setArrivedAt] = useState(0);
  const hold = (p: Push | null) => {
    if (!p) return;
    pending.current = p;
    setArrivedAt((n) => n + 1);
  };

  useEffect(() => {
    // Nothing to listen to in a browser or in Expo Go on Android (see lib/push.ts).
    if (!Notifications) return;
    let cancelled = false;

    // Cold start from a tapped notification.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      hold(pushOf(response.notification.request.content.data));
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      hold(pushOf(response.notification.request.content.data));
    });

    const arrived = Notifications.addNotificationReceivedListener((notification) => {
      const p = pushOf(notification.request.content.data);
      // An SOS is not a message to be read at leisure: the app is open, so it goes there.
      if (p?.type === "sos") hold(p);
      // The app is open: restart tracking quietly rather than sending the guard anywhere.
      else if (p?.type === "resume_tracking") void ensureTracking();
    });

    return () => {
      cancelled = true;
      tapped.remove();
      arrived.remove();
    };
  }, []);

  useEffect(() => {
    const p = pending.current;
    if (!p || !nav?.key || session === undefined) return;
    // Signed out: the sign-in page is where they are, and stays.
    if (!session) {
      pending.current = null;
      return;
    }
    // Wait for the profile, and for the launch to leave "/" for the home tab.
    if (!role || pathname === "/") return;

    pending.current = null;
    if (p.type === "resume_tracking") void ensureTracking();
    const target = targetFor(p, role);
    if (!target) return;
    if (typeof target === "string" && target.startsWith("/(")) router.navigate(target);
    else router.push(target);
  }, [arrivedAt, nav?.key, session, role, pathname]);

  return null;
}
