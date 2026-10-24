import { NextResponse } from "next/server";

import { toRing } from "@nbss/shared/geo";

import { validSosMapSig } from "@/lib/sos-map-sig";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTile } from "@/lib/tiles";

/**
 * A small map of where an SOS was raised, for the alert email: email clients
 * run no JavaScript, so the email carries a picture instead of a live map.
 *
 * Google's Static Maps when the API is enabled on the key (the key stays on the
 * server, never in the email); otherwise the same picture built here from
 * OpenStreetMap tiles out of our own cache. Either way: the site's fence in
 * green and a red pin where the guard pressed the button.
 *
 * GET /api/sos-map/<alert id>?s=<signature>   → image/png, 600×300 @2x
 */
export const dynamic = "force-dynamic";

const W = 600;
const H = 300;
const SCALE = 2;

type Pt = { lat: number; lng: number };

function circle(c: Pt, radiusM: number, steps = 36): Pt[] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return { lat: c.lat + dLat * Math.sin(a), lng: c.lng + dLng * Math.cos(a) };
  });
}

/** A zoom that fits the pin and the fence in the picture, between 14 and 18. */
function fitZoom(points: Pt[], centre: Pt): number {
  let span = 0;
  for (const p of points) {
    span = Math.max(span, Math.abs(p.lat - centre.lat) * 111_320 * 2, Math.abs(p.lng - centre.lng) * 111_320 * Math.cos((centre.lat * Math.PI) / 180) * 2);
  }
  // Metres per pixel at zoom z ≈ 156543·cos(lat)/2^z; keep the span within ~80% of the height.
  for (let z = 18; z >= 14; z--) {
    const mpp = (156_543 * Math.cos((centre.lat * Math.PI) / 180)) / 2 ** z;
    if (span / mpp < H * 0.8) return z;
  }
  return 14;
}

async function google(pin: Pt, fence: Pt[], zoom: number): Promise<Uint8Array | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const path = fence.length > 2 ? `&path=${encodeURIComponent(`color:0x009164ff|weight:3|fillcolor:0x00916433|${fence.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("|")}`)}` : "";
  const url =
    `https://maps.googleapis.com/maps/api/staticmap?size=${W}x${H}&scale=${SCALE}&zoom=${zoom}` +
    `&center=${pin.lat},${pin.lng}&markers=${encodeURIComponent(`color:red|${pin.lat},${pin.lng}`)}${path}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** Web Mercator: world pixel coordinates at a zoom, 256-px tiles. */
function project(p: Pt, zoom: number): { x: number; y: number } {
  const s = 256 * 2 ** zoom;
  const sin = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}

async function osm(pin: Pt, fence: Pt[], zoom: number): Promise<Uint8Array | null> {
  const sharp = (await import("sharp")).default;
  // Tiles at zoom+1 drawn at their native size give the @2x picture.
  const z = Math.min(19, zoom + 1);
  const w = W * SCALE;
  const h = H * SCALE;
  const c = project(pin, z);
  const left = c.x - w / 2;
  const top = c.y - h / 2;
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  for (let tx = Math.floor(left / 256); tx <= Math.floor((left + w) / 256); tx++) {
    for (let ty = Math.floor(top / 256); ty <= Math.floor((top + h) / 256); ty++) {
      const tile = await getTile(z, tx, ty);
      if (tile) tiles.push({ input: Buffer.from(tile.bytes), left: Math.round(tx * 256 - left), top: Math.round(ty * 256 - top) });
    }
  }
  if (tiles.length === 0) return null;
  const px = (p: Pt) => {
    const q = project(p, z);
    return `${(q.x - left).toFixed(1)},${(q.y - top).toFixed(1)}`;
  };
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      (fence.length > 2 ? `<polygon points="${fence.map(px).join(" ")}" fill="#00916433" stroke="#009164" stroke-width="5"/>` : "") +
      (() => {
        const [x, y] = px(pin).split(",").map(Number);
        return `<g transform="translate(${x},${y})"><path d="M0 0 C-14 -26 -26 -36 -26 -54 A26 26 0 1 1 26 -54 C26 -36 14 -26 0 0Z" fill="#dc2626" stroke="#fff" stroke-width="5"/><circle cx="0" cy="-54" r="10" fill="#fff"/></g>`;
      })() +
      `<rect x="${w - 330}" y="${h - 34}" width="330" height="34" fill="#ffffffcc"/><text x="${w - 12}" y="${h - 11}" font-family="Helvetica,Arial,sans-serif" font-size="20" text-anchor="end" fill="#555">© OpenStreetMap contributors</text>` +
      `</svg>`,
  );
  const png = await sharp({ create: { width: w, height: h, channels: 4, background: "#eef0ee" } })
    .composite([...tiles.filter((t) => t.left < w && t.top < h && t.left > -256 && t.top > -256), { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sig = new URL(request.url).searchParams.get("s");
  if (!/^[0-9a-f-]{36}$/.test(id) || !validSosMapSig(id, sig)) return new NextResponse("Not found", { status: 404 });

  const db = supabaseAdmin();
  const { data: alert } = await db.from("sos_alerts").select("lat, lng, site_id").eq("id", id).maybeSingle();
  if (!alert || alert.lat == null || alert.lng == null) return new NextResponse("No location", { status: 404 });
  const { data: site } = await db.from("sites").select("lat, lng, geofence_radius_m, polygon").eq("id", alert.site_id).maybeSingle();

  const pin = { lat: alert.lat, lng: alert.lng };
  const ring = site ? toRing(site.polygon) : null;
  const fence: Pt[] = site ? (ring && ring.length > 2 ? ring.map(([lng, lat]) => ({ lat, lng })).concat([{ lat: ring[0]![1], lng: ring[0]![0] }]) : circle(site, site.geofence_radius_m)) : [];
  const zoom = fitZoom([pin, ...fence], pin);

  const image = (await google(pin, fence, zoom)) ?? (await osm(pin, fence, zoom));
  if (!image) return new NextResponse("Map unavailable", { status: 502 });
  return new NextResponse(image.buffer as ArrayBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
