import { withoutSpikes } from "./geo";
import { SOS_KIND_LABEL, SOS_STATUS_LABEL } from "./sos";

/**
 * A guard's route on one shift, worked out the same way on the website and in the
 * app: the points `guard_trail()` returns, the stretches inside and outside the
 * fence, the distance, the stops and the quiet spells, and the timeline of moments.
 */

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

/** A route as the map draws it, with the phone's wild guesses taken out (withoutSpikes). */
export function toPoints(tuples: TrailTuple[] | null | undefined): TrailPoint[] {
  return withoutSpikes(rawPoints(tuples));
}

function rawPoints(tuples: TrailTuple[] | null | undefined): TrailPoint[] {
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

/**
 * A route cut where it crosses the fence, so each stretch can be drawn in its own
 * colour: inside (blue) or outside (orange). A stretch starts at the point that
 * crossed, so the lines join up.
 */
export function runsByFence<T extends { lat: number; lng: number; inside: boolean | null }>(
  points: readonly T[],
): { inside: boolean; path: { lat: number; lng: number }[] }[] {
  const runs: { inside: boolean; path: { lat: number; lng: number }[] }[] = [];
  for (const p of points) {
    const inside = p.inside !== false;
    const last = runs.at(-1);
    const at = { lat: p.lat, lng: p.lng };
    if (last && last.inside === inside) last.path.push(at);
    else {
      // The crossing stretch is drawn in the new colour, from the last point before it.
      const prev = last?.path.at(-1);
      runs.push({ inside, path: prev ? [prev, at] : [at] });
    }
  }
  return runs.filter((r) => r.path.length > 1);
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


/** An SOS raised during the shift, for the timeline. */
export type SosRow = { id: string; kind: string; status: string; raised_at: string; closed_at: string | null; lat: number | null; lng: number | null };

export type RouteEvent = {
  at: number;
  kind: "in" | "out" | "left" | "back" | "stop" | "gap" | "now" | "sos" | "sos_end";
  text: string;
  lat?: number;
  lng?: number;
  /** The route point it belongs to, for the playback head. */
  index: number;
};

/** The moments of a shift that matter, in order: in, stops, out of and back into the fence, quiet spells, SOS, the latest point. */
export function routeEvents(points: TrailPoint[], stats: TrailStats | null, sos: SosRow[]): RouteEvent[] {
  if (points.length === 0) return [];
  const out: RouteEvent[] = [];
  const first = points[0]!;
  out.push({ at: first.at, kind: "in", text: "Checked in", lat: first.lat, lng: first.lng, index: 0 });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.inside !== false && b.inside === false) out.push({ at: b.at, kind: "left", text: "Left the fence", lat: b.lat, lng: b.lng, index: i });
    if (a.inside === false && b.inside !== false) out.push({ at: b.at, kind: "back", text: "Back inside the fence", lat: b.lat, lng: b.lng, index: i });
    if (b.at - a.at > 10 * 60_000) out.push({ at: a.at, kind: "gap", text: `No signal for ${duration((b.at - a.at) / 60_000)}`, lat: a.lat, lng: a.lng, index: i - 1 });
  }
  (stats?.stops ?? []).forEach((s, n) => {
    const index = points.findIndex((p) => p.at >= s.from);
    out.push({ at: s.from, kind: "stop", text: `Stop ${n + 1} · ${duration((s.to - s.from) / 60_000)}${s.inside === false ? ", outside" : ""}`, lat: s.lat, lng: s.lng, index: Math.max(0, index) });
  });
  const nearest = (t: number) => {
    const i = points.findIndex((p) => p.at >= t);
    return i < 0 ? points.length - 1 : i;
  };
  for (const a of sos) {
    const at = new Date(a.raised_at).getTime();
    const i = nearest(at);
    const p = points[i]!;
    out.push({ at, kind: "sos", text: `SOS · ${SOS_KIND_LABEL[a.kind as keyof typeof SOS_KIND_LABEL] ?? "Emergency"}`, lat: a.lat ?? p.lat, lng: a.lng ?? p.lng, index: i });
    if (a.closed_at) {
      const end = new Date(a.closed_at).getTime();
      const j = nearest(end);
      out.push({ at: end, kind: "sos_end", text: `SOS ${(SOS_STATUS_LABEL[a.status as keyof typeof SOS_STATUS_LABEL] ?? "closed").toLowerCase()}`, lat: points[j]!.lat, lng: points[j]!.lng, index: j });
    }
  }
  const last = points.at(-1)!;
  if (points.length > 1) {
    out.push({ at: last.at, kind: last.reason === "check_out" ? "out" : "now", text: last.reason === "check_out" ? "Checked out" : "Latest position", lat: last.lat, lng: last.lng, index: points.length - 1 });
  }
  return out.sort((x, y) => x.at - y.at);
}

