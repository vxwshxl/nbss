import sharp from "sharp";

import { DESIGNS, isDesign, renderCard, renderCardPdf, type Side } from "@/lib/card/render";

/**
 * The visiting card files /card offers: `/card/<design>-front.png`,
 * `/card/<design>-back.png` and `/card/<design>.pdf` (both sides, card-sized), plus
 * a light `/card/<design>-<side>.webp` the page shows, so a phone is not handed six
 * full-size PNGs. Drawn once at build time.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DESIGNS.flatMap((d) => [
    ...(["front", "back"] as const).flatMap((side) => [{ file: `${d.id}-${side}.png` }, { file: `${d.id}-${side}.webp` }]),
    { file: `${d.id}.pdf` },
  ]);
}

const CACHE = "public, max-age=86400, stale-while-revalidate=604800";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  const pdf = /^([a-z]+)\.pdf$/.exec(file);
  if (pdf?.[1] && isDesign(pdf[1])) {
    const body = await renderCardPdf(pdf[1]);
    return new Response(new Uint8Array(body), { headers: { "Content-Type": "application/pdf", "Cache-Control": CACHE } });
  }

  const side = /^([a-z]+)-(front|back)\.(png|webp)$/.exec(file);
  if (side?.[1] && isDesign(side[1])) {
    const png = await renderCard(side[1], side[2] as Side);
    if (side[3] === "png") {
      return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": CACHE } });
    }
    const webp = await sharp(png).resize({ width: 1050 }).webp({ quality: 84 }).toBuffer();
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": CACHE } });
  }

  return new Response("Not found", { status: 404 });
}
