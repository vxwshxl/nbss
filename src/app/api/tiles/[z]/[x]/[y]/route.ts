import { NextResponse } from "next/server";

import { getObject, putObject } from "@/lib/r2";

/**
 * Map tiles, proxied and cached into R2.
 *
 * The site advertises `default-src 'self'` and means it. Pointing a map
 * straight at a tile CDN would need `img-src` opened to a third-party host,
 * which is exactly the exception the whole policy exists to avoid — so tiles
 * are fetched server-side and served from this origin instead.
 *
 * Caching them into the `nbss` bucket is not an optimisation detail. The
 * OpenStreetMap Foundation asks that heavy consumers do not hammer their tile
 * servers, and a console with a live map open all shift would. Each tile is
 * fetched from them at most once.
 */

const UPSTREAM = "https://tile.openstreetmap.org";

// Zoomed out past this a fence is invisible; past 19 OSM has no tiles.
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await params;

  const zoom = Number(z);
  const col = Number(x);
  const row = Number(y);

  // Bounds-checked before anything is fetched: these values land in an
  // upstream URL and an object key, and neither should ever see arbitrary text.
  const limit = 2 ** zoom;
  const valid =
    Number.isInteger(zoom) &&
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    zoom >= MIN_ZOOM &&
    zoom <= MAX_ZOOM &&
    col >= 0 &&
    col < limit &&
    row >= 0 &&
    row < limit;

  if (!valid) return new NextResponse("Bad tile", { status: 400 });

  const key = `tiles/osm/${zoom}/${col}/${row}.png`;

  const hit = await getObject(key);
  if (hit?.Body) {
    const cached = await hit.Body.transformToByteArray();
    return new NextResponse(cached.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Tile-Cache": "hit",
      },
    });
  }

  const upstream = await fetch(`${UPSTREAM}/${zoom}/${col}/${row}.png`, {
    headers: {
      // OSM's usage policy requires an identifying User-Agent; an anonymous
      // fetch is refused.
      "User-Agent": "NBSS-Operations/1.0 (+https://nbss.co.in; ops@nbss.co.in)",
    },
  });

  if (!upstream.ok) return new NextResponse("Tile unavailable", { status: 502 });

  const bytes = new Uint8Array(await upstream.arrayBuffer());

  // Written in the background: a slow bucket must not hold up the map.
  void putObject(key, bytes, "image/png").catch(() => undefined);

  return new NextResponse(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, immutable",
      "X-Tile-Cache": "miss",
    },
  });
}
