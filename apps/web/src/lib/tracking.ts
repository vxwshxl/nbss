import { STALE_AFTER_MS, OFFLINE_AFTER_MS } from "@nbss/shared/location";
import type { LivePosition } from "@nbss/shared/realtime";

// The route maths lives in @nbss/shared/trail, so the app draws routes the same way.
export {
  duration,
  km,
  metres,
  runsByFence,
  toPoints,
  trailStats,
  type TrailPoint,
  type TrailStats,
  type TrailTuple,
} from "@nbss/shared/trail";

import { MAP_COLOR } from "@/lib/google-maps";

/**
 * What the live screens say about a guard on duty, worked out the same way
 * everywhere: the map's dot colour, the list's chip and the dashboard count.
 */

export type GuardState = "sos" | "inside" | "outside" | "stale" | "offline" | "waiting";

export const STATE_LABEL: Record<GuardState, string> = {
  sos: "SOS",
  inside: "Inside fence",
  outside: "Outside fence",
  stale: "Signal late",
  offline: "No signal",
  waiting: "Waiting for GPS",
};

export const STATE_COLOR: Record<GuardState, string> = {
  sos: MAP_COLOR.sos,
  inside: MAP_COLOR.inside,
  outside: MAP_COLOR.outside,
  stale: "#a16207",
  offline: MAP_COLOR.stale,
  waiting: MAP_COLOR.stale,
};

/** Tailwind classes for the list chip, in the same colours as the map. */
export const STATE_CHIP: Record<GuardState, string> = {
  sos: "bg-rose-600 text-white",
  inside: "bg-emerald-600/12 text-emerald-700 dark:text-emerald-300",
  outside: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  stale: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  offline: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  waiting: "bg-slate-500/10 text-slate-500",
};

/** When the phone was last heard from, which can be later than its last position. */
export function heardAt(p: Pick<LivePosition, "recorded_at" | "received_at"> | null): number | null {
  if (!p) return null;
  return new Date(p.received_at ?? p.recorded_at).getTime();
}

export function guardState(p: LivePosition | null, sos: boolean, now: number): GuardState {
  if (sos) return "sos";
  const heard = heardAt(p);
  if (!p || heard === null) return "waiting";
  const age = now - heard;
  if (age > OFFLINE_AFTER_MS) return "offline";
  if (age > STALE_AFTER_MS) return "stale";
  return p.inside_fence === false ? "outside" : "inside";
}

/** "just now", "4 min ago", "2 h 5 min ago". */
export function ago(ms: number | null, now: number): string {
  if (ms === null) return "never";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

export function istClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
}

export function istClockSeconds(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}

/**
 * "1.0.0 (27)" → "app 1.0.0 · build 27". Builds before 24 sent only "1.0.0", so those
 * read "build 23 or older".
 */
export function appLabel(appVersion: string): string {
  const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(appVersion.trim());
  return m ? `app ${m[1]} · build ${m[2]}` : `app ${appVersion.trim()} · build 23 or older`;
}
