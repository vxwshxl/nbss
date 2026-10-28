import { ImageResponse } from "next/og";

import { AronaiBand, BRAND, BRAND_DEEP, INK, INK_DIM, PAPER, asJpeg, ogAssets } from "@/lib/og/parts";

/**
 * The share card for /android (1200×630): the lockup and "Get the NBSS Kokrajhar app"
 * on the left, and on the right the app itself, its sign-in screen in a phone, against
 * the night of the gate scene. Drawn from the same parts as /og.
 */
export const dynamic = "force-static";

const NIGHT = "#06110d";

export async function GET() {
  const { logoSrc, fonts } = await ogAssets();

  const png = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "Geist" }}>
        <AronaiBand />
        <div style={{ position: "relative", flex: 1, display: "flex" }}>
          {/* The night, with the phone on it. */}
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 470,
              height: 602,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(70% 60% at 50% 40%, #0f3a2b 0%, ${NIGHT} 70%)`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 262,
                height: 520,
                padding: 10,
                borderRadius: 44,
                background: "#111",
                boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, borderRadius: 36, background: PAPER, padding: "46px 22px 0" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoSrc} alt="" width={46} height={46} />
                  <div style={{ display: "flex", fontSize: 48, fontWeight: 700, letterSpacing: "-0.045em", marginLeft: 8 }}>NBSS</div>
                </div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 34, letterSpacing: "-0.02em" }}>Login</div>
                <div style={{ display: "flex", alignSelf: "stretch", height: 42, marginTop: 22, borderRadius: 12, border: "1.5px solid #E5E5E5", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 500 }}>
                  Sign in with Google
                </div>
                <div style={{ display: "flex", fontSize: 12, color: INK_DIM, marginTop: 12 }}>or</div>
                <div
                  style={{
                    display: "flex",
                    alignSelf: "stretch",
                    height: 42,
                    marginTop: 12,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 700,
                    color: PAPER,
                    background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DEEP})`,
                  }}
                >
                  Staff &amp; guards
                </div>
                <div style={{ display: "flex", alignSelf: "stretch", flex: 1, marginTop: 30, marginLeft: -22, marginRight: -22, borderRadius: "22px 22px 0 0", background: NIGHT }} />
              </div>
            </div>
          </div>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 72px", width: 720 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" width={74} height={74} />
              <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: "-0.045em", marginLeft: 12, lineHeight: 0.9 }}>NBSS</div>
            </div>
            <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 34, padding: "6px 14px", borderRadius: 999, background: "#E6F4EE", color: BRAND_DEEP, fontSize: 22, fontWeight: 700 }}>
              Android app
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 700, marginTop: 18, letterSpacing: "-0.035em", lineHeight: 1.02 }}>
              <span>Get the NBSS</span>
              <span>Kokrajhar app</span>
            </div>
            <div style={{ display: "flex", fontSize: 25, fontWeight: 500, marginTop: 18, color: INK_DIM }}>
              For guards, supervisors, the office and clients
            </div>
            <div style={{ display: "flex", fontSize: 23, fontWeight: 700, marginTop: 26, color: BRAND_DEEP }}>nbsskokrajhar.com/android</div>
          </div>
        </div>
        <AronaiBand />
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );

  return asJpeg(png);
}
