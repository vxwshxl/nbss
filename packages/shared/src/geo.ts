/**
 * Geofence maths, mirrored from Postgres.
 *
 * `geo_distance_m`, `point_in_ring` and `site_fence_check` in
 * 0001_foundation.sql are the authority: a punch is allowed or refused by the
 * database, from coordinates it stored, against a clock it owns. Nothing here
 * decides anything.
 *
 * What these are for is the half-second before that round trip — colouring the
 * check-in button green when the guard is already inside the fence, drawing the
 * ring on the map, telling someone walking towards a gate how many metres are
 * left. Answering that from the server would mean a request per GPS tick.
 *
 * The formulas are kept character-for-character equivalent to the SQL on
 * purpose. If you change one, change both, or the button will lie.
 */

const EARTH_RADIUS_M = 6_371_000;

export type Point = { lat: number; lng: number };

/** A GeoJSON linear ring as stored in sites.polygon: [[lng, lat], ...]. */
export type Ring = readonly (readonly [number, number])[];

/** Haversine metres between two WGS84 points. Mirrors `geo_distance_m`. */
export function distanceMetres(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Ray casting over a linear ring. Mirrors `point_in_ring`. */
export function pointInRing(ring: Ring, point: Point): boolean {
  const n = ring.length;
  if (n < 3) return false;

  let hit = false;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const vi = ring[i];
    const vj = ring[j];
    if (!vi || !vj) return false;

    const [xi, yi] = vi;
    const [xj, yj] = vj;

    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi
    ) {
      hit = !hit;
    }
  }
  return hit;
}

/** The fence a site advertises. Polygon wins when one is drawn, as in the SQL. */
export type Fence = {
  lat: number;
  lng: number;
  geofence_radius_m: number;
  ring?: Ring | null;
};

export type FenceVerdict = {
  inside: boolean;
  distanceM: number;
  /** Metres still to walk, or 0 once inside. Handy for a live readout. */
  remainingM: number;
};

/**
 * Mirrors `site_fence_check`. A drawn polygon replaces the radius entirely
 * rather than intersecting it, so an operator who traces a compound gets
 * exactly the shape they drew.
 */
export function checkFence(fence: Fence, point: Point): FenceVerdict {
  const distanceM = distanceMetres({ lat: fence.lat, lng: fence.lng }, point);
  const inside = fence.ring?.length
    ? pointInRing(fence.ring, point)
    : distanceM <= fence.geofence_radius_m;

  return {
    inside,
    distanceM,
    remainingM: inside ? 0 : Math.max(0, distanceM - fence.geofence_radius_m),
  };
}

/** The nearest of several sites, for a guard rostered to more than one. */
export function nearestFence<T extends Fence>(
  fences: readonly T[],
  point: Point,
): { fence: T; verdict: FenceVerdict } | null {
  let best: { fence: T; verdict: FenceVerdict } | null = null;
  for (const fence of fences) {
    const verdict = checkFence(fence, point);
    // An inside verdict always beats an outside one, however close the outside
    // one is — standing in a compound is not a matter of degree.
    const better =
      !best ||
      (verdict.inside && !best.verdict.inside) ||
      (verdict.inside === best.verdict.inside && verdict.distanceM < best.verdict.distanceM);
    if (better) best = { fence, verdict };
  }
  return best;
}

/** "120 m away" / "1.4 km away" — the string under the check-in button. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return "—";
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/**
 * Parses whatever came out of the `polygon` jsonb column.
 *
 * Deliberately total: a malformed ring returns null rather than throwing, so a
 * site someone half-drew in the table editor degrades to its radius instead of
 * blanking the map.
 */
export function toRing(value: unknown): Ring | null {
  if (!Array.isArray(value)) return null;
  const ring: [number, number][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length < 2) return null;
    const [lng, lat] = entry as unknown[];
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}
