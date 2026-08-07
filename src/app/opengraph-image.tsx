import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { site } from "@/content/site";

/**
 * The social preview card, generated at build time for every route.
 *
 * File-convention Open Graph images are the reason this is a route and not a
 * static asset: Next emits `og:image`, `og:image:width`, `og:image:height` and
 * `twitter:image` for it automatically, always against `metadataBase`, so the
 * URL can never drift out of sync with the deployment the way a hand-written
 * `openGraph.images` entry did.
 *
 * The design is deliberately flat — brand field, Aronai band, wordmark, no
 * photograph. A 1200×630 PNG of flat colour compresses to a few tens of
 * kilobytes, where the same frame carrying the hero photo lands in the
 * megabytes. WhatsApp silently drops preview images past a few hundred KB, and
 * a preview that always renders beats a prettier one that usually does not.
 */
export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#E2A93C";
const GREEN = "#19A96E";
const RUST = "#D45A3A";
const INK = "#0A100D";
const PAPER = "#F4F1EA";

/** One Aronai tile, repeated across the band. Mirrors the SVG pattern 1:1. */
function AronaiTile({ x }: { x: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: 36,
        height: 14,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 4,
          top: 2,
          width: 10,
          height: 10,
          border: `1.5px solid ${GOLD}`,
          transform: "rotate(45deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 22,
          top: 2,
          width: 10,
          height: 10,
          border: `1.5px solid ${GREEN}`,
          transform: "rotate(45deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 4,
          width: 6,
          height: 6,
          background: RUST,
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

function AronaiBand() {
  const tiles = Array.from({ length: 34 }, (_, i) => i * 36);
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: 14,
        background: "#04120C",
        borderTop: `1px solid ${GREEN}`,
        borderBottom: `1px solid ${GREEN}`,
      }}
    >
      {tiles.map((x) => (
        <AronaiTile key={x} x={x} />
      ))}
    </div>
  );
}

/**
 * The badge, inlined as a data URI.
 *
 * `ImageResponse` renders on the server and cannot fetch a relative URL — there
 * is no origin to resolve it against — so the file is read off disk and
 * base64'd into the `src`.
 *
 * PNG, not the WebP the rest of the site uses: Satori, which rasterises this
 * card, decodes PNG, JPEG and SVG only, and hands back an opaque
 * "u2 is not iterable" if given anything else. The 96px size matches the size
 * it is drawn at, and keeps the inlined bytes off a card that WhatsApp drops
 * once it grows past a few hundred KB.
 */
const badge = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/icon-96.png"),
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: INK,
          color: PAPER,
        }}
      >
        <AronaiBand />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 84px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <img src={badge} width={96} height={96} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: -2 }}>
                {site.shortName}
              </div>
              <div style={{ fontSize: 21, color: "#9BA69F", letterSpacing: 1 }}>{site.name}</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: -1.5,
              marginTop: 46,
              maxWidth: 900,
            }}
          >
            Your Safety, Our Responsibility.
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 25,
              color: "#9BA69F",
              marginTop: 26,
              maxWidth: 880,
            }}
          >
            Trained security personnel · Kokrajhar, Assam
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
            {[
              "Registered under Govt. of Assam",
              "Police-verified guards",
              "24 × 7 supervision",
            ].map(
              (chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    fontSize: 18,
                    color: "#C8CEC8",
                    border: "1px solid #23302A",
                    borderRadius: 4,
                    padding: "9px 16px",
                  }}
                >
                  {chip}
                </div>
              ),
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 84px 40px",
            fontSize: 20,
            color: "#7E8A83",
          }}
        >
          <div style={{ display: "flex" }}>
            {site.address.city}, {site.address.state} ({site.address.region})
          </div>
          <div style={{ display: "flex", color: GOLD }}>{site.phone}</div>
        </div>

        <AronaiBand />
      </div>
    ),
    size,
  );
}
