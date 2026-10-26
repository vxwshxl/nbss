import { STALE_AFTER_MS, OFFLINE_AFTER_MS } from "@nbss/shared/location";
import type { LivePosition } from "@nbss/shared/realtime";

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

/** "3 h 12 min" for a duration in minutes. */
export function duration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

/** Great-circle metres, for summing a trail in the browser. */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function km(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10_000 ? 2 : 1)} km`;
}

/**
 * One point of a route, as `guard_trail()` returns it:
 * [lat, lng, epoch seconds, accuracy m, inside fence, battery %, speed m/s, reason].
 */
export type TrailTuple = [number, number, number, number, boolean | null, number | null, number, string | null];

export type TrailPoint = {
  lat: number;
  lng: number;
  at: number;
  accuracy: number;
  inside: boolean | null;
  battery: number | null;
  speed: number;
  reason: string | null;
};

export function toPoints(tuples: TrailTuple[] | null | undefined): TrailPoint[] {
  return (tuples ?? []).map(([lat, lng, t, accuracy, inside, battery, speed, reason]) => ({
    lat: Number(lat),
    lng: Number(lng),
    at: Number(t) * 1000,
    accuracy: Number(accuracy),
    inside,
    battery,
    speed: Number(speed),
    reason,
  }));
}

export type TrailStats = {
  distanceM: number;
  outsideMinutes: number;
  stops: { lat: number; lng: number; from: number; to: number; inside: boolean | null }[];
  gaps: { from: number; to: number }[];
};

/**
 * What a supervisor wants from a path: how far, how long outside the fence,
 * where they stopped (5+ minutes within ~40 m), and where the phone went quiet
 * (no point for 10+ minutes) — a gap is a question to ask, not a fact.
 */
export function trailStats(points: TrailPoint[]): TrailStats {
  let distanceM = 0;
  let outsideMs = 0;
  const stops: TrailStats["stops"] = [];
  const gaps: TrailStats["gaps"] = [];

  let anchor = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = metres(a, b);
    // Jitter while standing still is not distance walked.
    if (d > Math.max(8, Math.min(a.accuracy, b.accuracy) * 0.5)) distanceM += d;
    if (a.inside === false) outsideMs += b.at - a.at;
    if (b.at - a.at > 10 * 60_000) gaps.push({ from: a.at, to: b.at });

    if (metres(points[anchor]!, b) > 40) {
      const p = points[anchor]!;
      if (a.at - p.at >= 5 * 60_000) stops.push({ lat: p.lat, lng: p.lng, from: p.at, to: a.at, inside: p.inside });
      anchor = i;
    }
  }
  const last = points.at(-1);
  const p = points[anchor];
  if (last && p && last.at - p.at >= 5 * 60_000) stops.push({ lat: p.lat, lng: p.lng, from: p.at, to: last.at, inside: p.inside });

  return { distanceM, outsideMinutes: outsideMs / 60_000, stops, gaps };
}

export function istClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
}

export function istClockSeconds(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
}
