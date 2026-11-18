import { OFFLINE_AFTER_MS, STALE_AFTER_MS } from "@nbss/shared/location";
import type { Ring } from "@nbss/shared/geo";

/** What the maps draw — Google Maps on the phone and in the browser preview. */

export type MapPoint = { lat: number; lng: number };

export type MapSite = MapPoint & {
  id: string;
  name: string;
  radiusM: number;
  ring: Ring | null;
};

export type LiveMapProps = {
  /** The phone, as the watch last reported it. */
  me: (MapPoint & { accuracyM: number; heading?: number | null }) | null;
  /** The site the guard is heading to, or standing at. */
  site: MapSite | null;
  /** Whether `me` is inside `site`'s boundary — green when it is. */
  inside: boolean;
  /** Changed to re-frame the camera around the guard and the site. */
  frameKey: string;
  /** Room taken by what floats over the map, so framing uses what is left. */
  padding: { top: number; right: number; bottom: number; left: number };
  /** The path walked since check-in, while on duty. */
  trail?: MapPoint[] | null;
  /** Other sites where duties are going on now: faint, for context, not framed. */
  areas?: MapSite[];
  /** Colleagues on duty with this guard, as small green dots with first names. */
  friends?: (MapPoint & { id: string; name: string })[];
  onFriendPress?: (id: string) => void;
  /** Open SOS: their areas blink red and whoever raised one is marked. */
  sos?: { areaIds: string[]; raisers: (MapPoint & { id: string; label: string })[] };
  onSosPress?: () => void;
};

/** Google draws its own credit on the map, so there is nothing extra to show. */
export const ATTRIBUTION = "";

/** A radius fence as a polygon, so both renderers draw one shape. */
export function circleRing(center: MapPoint, radiusM: number, steps = 72): [number, number][] {
  const lat = (center.lat * Math.PI) / 180;
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(lat));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/** The site's boundary as [lng, lat] pairs: the drawn polygon, or the circle. */
export function fenceRing(site: MapSite): [number, number][] {
  if (site.ring && site.ring.length >= 3) return site.ring.map(([lng, lat]) => [lng, lat]);
  return circleRing(site, site.radiusM);
}

/** [west, south, east, north] around the guard and the whole boundary. */
export function frameBounds(me: MapPoint | null, site: MapSite | null): [number, number, number, number] | null {
  const points: [number, number][] = [];
  if (site) points.push(...fenceRing(site));
  if (me) points.push([me.lng, me.lat]);
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

export const MAP_COLOR = {
  me: "#2563eb",
  inside: "#009164",
  outside: "#d97706",
  route: "#0d0d0d",
} as const;

/** "Pranab Boro" → "PB", "Mithun" → "MI". */
export function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * A guard on duty as the website's Live tracking reads them (apps/web/src/lib/
 * tracking.ts), so the phone and the console agree: SOS, inside or outside their
 * fence while their phone reports, "signal late" after three missed heartbeats and
 * "no signal" after eight. Heard is when the server last had a fix from them.
 */
export type GuardState = "sos" | "inside" | "outside" | "stale" | "offline";

export const STATE_COLOR: Record<GuardState, string> = {
  sos: "#dc2626",
  inside: "#009164",
  outside: "#d97706",
  stale: "#a16207",
  offline: "#94a3b8",
};

export function guardState(
  p: { recorded_at: string; received_at?: string | null; inside_fence: boolean | null; mode?: string | null },
  sos: boolean,
  now: number,
): GuardState {
  if (sos || p.mode === "emergency") return "sos";
  const age = now - new Date(p.received_at ?? p.recorded_at).getTime();
  if (age > OFFLINE_AFTER_MS) return "offline";
  if (age > STALE_AFTER_MS) return "stale";
  return p.inside_fence === false ? "outside" : "inside";
}

/** A direction is drawn only while it is current: not for a phone that has gone quiet. */
export function liveHeading(state: GuardState, heading: number | null | undefined): number | null {
  return (state === "inside" || state === "outside" || state === "sos") && heading != null ? heading : null;
}
