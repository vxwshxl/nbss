import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { AronaiBand, BRAND, BRAND_DEEP, INK, INK_DIM, PAPER } from "@/lib/og/parts";

/**
 * The share card for /brochure (1200×630), served at `/og/brochure`.
 *
 * Laid out as the SchoolERP card is: the mark and name, a small capitals line, one
 * large promise with its last words in green, the sectors as chips, and a rule
 * with the address and three facts under it. The guards fade in on the right, so
 * the preview in a WhatsApp chat reads as a security company before a word is read.
 *
 * JPEG, as /og is, to stay well under the size WhatsApp drops previews at.
 */
export const dynamic = "force-static";

const CHIPS = ["Schools", "Hospitals", "Government", "Banks & ATMs", "Hotels"];
/** The photo stops above the footer rule, so the address and facts sit on white. */
const PHOTO_H = 470;

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
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "Geist" }}>
        <AronaiBand />
        <div style={{ position: "relative", flex: 1, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={guardsSrc} alt="" width={460} height={PHOTO_H} style={{ position: "absolute", right: 0, top: 0, width: 460, height: PHOTO_H, objectFit: "cover", objectPosition: "50% 30%" }} />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 460,
              height: PHOTO_H,
              display: "flex",
              background: `linear-gradient(90deg, ${PAPER} 0%, rgba(255,255,255,0.8) 22%, rgba(255,255,255,0) 60%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: PHOTO_H - 120,
              width: 460,
              height: 120,
              display: "flex",
              background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${PAPER} 100%)`,
            }}
          />

          <div style={{ position: "relative", display: "flex", flexDirection: "column", padding: "52px 0 0 72px", width: 860 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" width={64} height={64} />
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>NBSS</div>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 500, color: INK_DIM, marginTop: 6 }}>National Bodo Security Service</div>
              </div>
            </div>

            <div style={{ display: "flex", fontSize: 17, fontWeight: 700, letterSpacing: "0.2em", color: BRAND_DEEP, marginTop: 44 }}>
              COMPANY PROFILE · SECURITY SERVICES
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.02, marginTop: 18 }}>
              <div style={{ display: "flex" }}>Trained guards for</div>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <span>every site,&nbsp;</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: BRAND }}>across Assam.</span>
                  <div style={{ display: "flex", height: 5, marginTop: 4, borderRadius: 3, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DEEP})` }} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 34, width: 700 }}>
              {CHIPS.map((c) => (
                <div
                  key={c}
                  style={{ display: "flex", fontSize: 19, fontWeight: 500, padding: "8px 18px", borderRadius: 999, border: "1.5px solid #E3E8E5", background: PAPER }}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              bottom: 34,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1.5px solid #E3E8E5",
              paddingTop: 20,
            }}
          >
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>nbsskokrajhar.com/brochure</div>
            <div style={{ display: "flex", fontSize: 19, fontWeight: 500, color: INK_DIM }}>Police verified · 24×7 supervision · Kokrajhar, Assam</div>
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

  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
