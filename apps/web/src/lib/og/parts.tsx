import { readFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

/**
 * What the share cards (/og, /og/android) are drawn from, so each card is the same
 * brand: the colours, the Aronai band along top and foot, the fonts and the mark.
 */
/* Literals, because Satori resolves no cascade. Same values as globals.css. */
export const BRAND = "#009164";
export const BRAND_DEEP = "#00714E";
export const INK = "#171717";
export const INK_DIM = "#4D4D4D";
export const PAPER = "#FFFFFF";
const BAND = "#F2F8F4";
const BAND_LINE = "#DCEBE1";

/** One Aronai tile, repeated across the band. Mirrors the SVG pattern 1:1. */
function AronaiTile({ x }: { x: number }) {
  const diamond = (left: number, color: string) => ({
    position: "absolute" as const,
    left,
    top: 2,
    width: 10,
    height: 10,
    border: `1.5px solid ${color}`,
    transform: "rotate(45deg)",
  });
  return (
    <div style={{ position: "absolute", left: x, top: 0, width: 36, height: 14, display: "flex" }}>
      <div style={diamond(4, BRAND_DEEP)} />
      <div style={diamond(22, BRAND)} />
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 4,
          width: 6,
          height: 6,
          background: BRAND_DEEP,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

export function AronaiBand() {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: 14,
        background: BAND,
        borderTop: `1px solid ${BAND_LINE}`,
        borderBottom: `1px solid ${BAND_LINE}`,
      }}
    >
      {Array.from({ length: 34 }, (_, i) => (
        <AronaiTile key={i} x={i * 36} />
      ))}
    </div>
  );
}


/** Geist bold and medium, and the mark as a data URL. */
export async function ogAssets() {
  const root = process.cwd();
  const [bold, medium, logo] = await Promise.all([
    readFile(join(root, "assets/fonts/Geist-Bold.ttf")),
    readFile(join(root, "assets/fonts/Geist-Medium.ttf")),
    readFile(join(root, "public/logo/nbss-512.png")),
  ]);
  return {
    logoSrc: `data:image/png;base64,${logo.toString("base64")}`,
    fonts: [
      { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Geist", data: medium, weight: 500 as const, style: "normal" as const },
    ],
  };
}

/** Satori's PNG as a ~100 KB JPEG: a photo-sized PNG is past where WhatsApp drops the preview. */
export async function asJpeg(png: Response): Promise<Response> {
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
