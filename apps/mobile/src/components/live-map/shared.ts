import type { Ring } from "@nbss/shared/geo";

import { WEB_URL } from "@/lib/config";

/**
 * What both map renderers draw — MapLibre on the phone, Leaflet in the browser
 * preview — so the duty screen hands either one the same props.
 */

export type MapPoint = { lat: number; lng: number };

export type MapSite = MapPoint & {
  id: string;
  name: string;
  radiusM: number;
  ring: Ring | null;
};

export type LiveMapProps = {
  /** The phone, as the watch last reported it. */
  me: (MapPoint & { accuracyM: number }) | null;
  /** The site the guard is heading to, or standing at. */
  site: MapSite | null;
  /** Whether `me` is inside `site`'s boundary — green when it is. */
  inside: boolean;
  /** Changed to re-frame the camera around the guard and the site. */
  frameKey: string;
  /** Room taken by what floats over the map, so framing uses what is left. */
  padding: { top: number; right: number; bottom: number; left: number };
};

/**
 * The console's own tile proxy when the app knows where the console is, so the
 * phones share its R2 cache instead of each asking OpenStreetMap.
 */
export const TILE_URL = WEB_URL
  ? `${WEB_URL}/api/tiles/{z}/{x}/{y}`
  : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Drawn by the duty screen just above its sheet: both maps' own credit sits in
 * a corner the sheet covers, and OpenStreetMap's licence asks for it visible.
 */
export const ATTRIBUTION = "© OpenStreetMap contributors";

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
