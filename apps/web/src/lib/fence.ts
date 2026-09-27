import type { Json } from "@/lib/supabase/types";

/**
 * A polygon column is `Json`, so it has to be narrowed before it can be drawn.
 * Anything that is not a list of `[lng, lat]` pairs is treated as no polygon at
 * all rather than half-drawn — a fence rendered from malformed data is worse
 * than no fence, because it looks authoritative.
 */
export function toRing(value: Json | null): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const ring: [number, number][] = [];
  for (const point of value) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (typeof lng !== "number" || typeof lat !== "number") return null;
    ring.push([lng, lat]);
  }
  return ring.length >= 3 ? ring : null;
}

/** A place, opened in Google Maps — on a phone, straight into navigation. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
