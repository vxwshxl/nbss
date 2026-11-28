import { ImageResponse } from "next/og";

import { cardPngDataUrl } from "@/lib/card/render";
import { AronaiBand, asJpeg, BRAND, BRAND_DEEP, ogAssets } from "@/lib/og/parts";

/**
 * The share card for /card (1200×630), served at `/og/card`: the visiting card
 * itself, front over back, so the WhatsApp preview is the card the link is for.
 */
export const dynamic = "force-static";

const NIGHT = "#04120C";

export async function GET() {
  const [{ fonts }, front, back] = await Promise.all([
    ogAssets(),
    cardPngDataUrl("daylight", "front", 700),
    cardPngDataUrl("night", "back", 700),
  ]);
  const shadow = "0 30px 60px rgba(0,0,0,0.45), 0 8px 18px rgba(0,0,0,0.3)";

  return asJpeg(
    new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: NIGHT, color: "#fff", fontFamily: "Geist" }}>
          <AronaiBand />
          <div
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              background: `radial-gradient(circle at 78% 45%, #0F3A28 0%, ${NIGHT} 62%)`,
            }}
          >
            <div style={{ position: "relative", display: "flex", flexDirection: "column", padding: "74px 0 0 72px", width: 470 }}>
              <div style={{ display: "flex", fontSize: 17, fontWeight: 700, letterSpacing: "0.2em", color: "#E2A93C" }}>NBSS · VISITING CARD</div>
              <div style={{ display: "flex", flexDirection: "column", fontSize: 58, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 20 }}>
                <span>Three designs,</span>
                <span>front and back.</span>
              </div>
              <div style={{ display: "flex", width: 90, height: 5, borderRadius: 3, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DEEP})`, marginTop: 26 }} />
              <div style={{ display: "flex", fontSize: 23, fontWeight: 500, color: "#B9D3C5", lineHeight: 1.4, marginTop: 24 }}>
                Print-ready PNG and PDF. Pick one and send it to the press.
              </div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 700, marginTop: 40 }}>nbsskokrajhar.com/card</div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={back}
              width={560}
              height={320}
              alt=""
              style={{ position: "absolute", left: 600, top: 46, borderRadius: 14, transform: "rotate(5deg)", boxShadow: shadow }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={front}
              width={560}
              height={320}
              alt=""
              style={{ position: "absolute", left: 540, top: 222, borderRadius: 14, transform: "rotate(-4deg)", boxShadow: shadow }}
            />
          </div>
          <AronaiBand />
        </div>
      ),
      { width: 1200, height: 630, fonts },
    ),
  );
}
