import "server-only";

import { getObject, putObject } from "@/lib/r2";

/**
 * One OpenStreetMap tile, from the R2 cache or, once, from OSM itself.
 *
 * Shared by the /api/tiles proxy and the SOS email's map picture. The
 * OpenStreetMap Foundation asks heavy users not to hammer their servers, so
 * each tile is fetched from them at most once and kept in the `nbss` bucket.
 */
const UPSTREAM = "https://tile.openstreetmap.org";

export async function getTile(zoom: number, col: number, row: number): Promise<{ bytes: Uint8Array; cache: "hit" | "miss" } | null> {
  const key = `tiles/osm/${zoom}/${col}/${row}.png`;
  const hit = await getObject(key).catch(() => null);
  if (hit?.Body) return { bytes: await hit.Body.transformToByteArray(), cache: "hit" };

  const upstream = await fetch(`${UPSTREAM}/${zoom}/${col}/${row}.png`, {
    // OSM's usage policy requires an identifying User-Agent; an anonymous fetch is refused.
    headers: { "User-Agent": "NBSS-Operations/1.0 (+https://nbsskokrajhar.com; support@nbsskokrajhar.com)" },
  }).catch(() => null);
  if (!upstream?.ok) return null;

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  // Written in the background: a slow bucket must not hold up the map.
  void putObject(key, bytes, "image/png").catch(() => undefined);
  return { bytes, cache: "miss" };
}
