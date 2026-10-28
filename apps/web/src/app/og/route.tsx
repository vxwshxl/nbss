import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { site } from "@/content/site";

/**
 * The share card for every page (1200×630), served at `/og`.
 *
 * Left: the lockup exactly as `BrandLockup` draws it — the mark, "NBSS", and the
 * two lines under it spread to end where the last S ends. Right: three of the
 * company's own guards (`assets/og/guards.jpg`, cropped from
 * `public/img/nbss/guards-on-duty.webp`). Never draw the brand another way here.
 *
 * Satori only emits PNG, and a PNG of a photograph lands near a megabyte —
 * past the point where WhatsApp silently drops the preview. So the PNG is
 * re-encoded as JPEG before it leaves, which keeps the card around 100 KB.
 *
 * A route rather than `opengraph-image.tsx` so one stable URL serves the
 * metadata, the JSON-LD `image`, and anything else that wants the banner.
 */
export const dynamic = "force-static";

import { AronaiBand, BRAND, BRAND_DEEP, INK, INK_DIM, PAPER } from "@/lib/og/parts";

export async function GET() {
  const root = process.cwd();
  const [bold, medium, logo, guards] = await Promise.all([
    readFile(join(root, "assets/fonts/Geist-Bold.ttf")),
    readFile(join(root, "assets/fonts/Geist-Medium.ttf")),
    readFile(join(root, "public/logo/nbss-512.png")),
    readFile(join(root, "assets/og/guards.jpg")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const guardsSrc = `data:image/jpeg;base64,${guards.toString("base64")}`;

  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          color: INK,
          fontFamily: "Geist",
        }}
      >
        <AronaiBand />
        <div style={{ position: "relative", flex: 1, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={guardsSrc}
            alt=""
            width={620}
            height={602}
            style={{ position: "absolute", right: 0, top: 0, width: 620, height: 602, objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 620,
              height: 602,
              display: "flex",
              background: `linear-gradient(90deg, ${PAPER} 0%, rgba(255,255,255,0.85) 14%, rgba(255,255,255,0) 42%)`,
            }}
          />

          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 0 0 72px",
              width: 680,
            }}
          >
            {/* The lockup shrinks to its first row ("[mark] NBSS"); the two lines below
                spread their letters across exactly that width, as BrandLockup does with
                SVG textLength. */}
            <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="" width={124} height={124} />
                <div
                  style={{
                    fontSize: 140,
                    fontWeight: 700,
                    letterSpacing: "-0.045em",
                    lineHeight: 0.9,
                    marginLeft: 18,
                    display: "flex",
                  }}
                >
                  {site.shortName}
                </div>
              </div>
              {["National Bodo", "Security Service"].map((line, i) => (
                <div
                  key={line}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignSelf: "stretch",
                    fontSize: 56,
                    fontWeight: 500,
                    color: INK_DIM,
                    lineHeight: 1.1,
                    marginTop: i === 0 ? 16 : 0,
                  }}
                >
                  {line.split("").map((ch, j) => (
                    <span key={j}>{ch === " " ? " " : ch}</span>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", width: 112, height: 6, marginTop: 34, background: BRAND, borderRadius: 3 }} />
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, marginTop: 22, letterSpacing: "-0.02em" }}>
              {site.tagline}
            </div>
            <div style={{ display: "flex", fontSize: 23, fontWeight: 500, marginTop: 10, color: INK_DIM }}>
              Trained, police-verified guards · {site.address.city}, Assam
            </div>
            <div style={{ display: "flex", fontSize: 23, fontWeight: 700, marginTop: 26, color: BRAND_DEEP }}>
              {site.phone}
            </div>
          </div>
        </div>
        <AronaiBand />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
      ],
    },
  );

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer()))
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
