import { join } from "node:path";

import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";

import { site } from "@/content/site";
import { ogAssets } from "@/lib/og/parts";

import { DESIGNS, type DesignId, type Side } from "./designs";

export { DESIGNS, type DesignId, type Side };

/**
 * The visiting card, drawn by Satori: three designs, each with a front and a back.
 *
 * Every side is drawn at 2100 × 1200 px, which is the standard Indian visiting card
 * (3.5 × 2 in, 89 × 51 mm) at 600 dpi, so a print shop gets more detail than it can
 * use. Text keeps 100 px (about 4 mm) clear of every edge, inside any trim.
 *
 * /card shows these same images and downloads them, so what the team picks on
 * screen is exactly what goes to the printer.
 */

export const CARD_W = 2100;
export const CARD_H = 1200;


const BRAND = "#009164";
const BRAND_DEEP = "#00714E";
const INK = "#171717";
const INK_DIM = "#4D4D4D";
const PAPER = "#FFFFFF";
const MINT = "#F2F8F4";
const LINE = "#DCEBE1";
const NIGHT = "#04120C";
const NIGHT_2 = "#0B2A1E";
const GOLD = "#E2A93C";
const MOSS = "#B9D3C5";

const WEBSITE = "nbsskokrajhar.com";
/** Main desk first, as everywhere else; the WhatsApp line is marked where it is shown. */
const PHONES = site.phones.map((p) => p.replace(/^\+91\s*/, ""));
const WHATSAPP = site.phones[1].replace(/^\+91\s*/, "");

/* ── Assets ─────────────────────────────────────────────────────────────── */

/**
 * A photo cropped to exactly `w × h` around a focal point (0–1 across and down), as
 * a JPEG data URL. Satori draws JPEG and PNG, not the site's WebP, and cropping here
 * keeps the photo sharp and the PNG small.
 */
async function photo(name: string, w: number, h: number, fx = 0.5, fy = 0.5): Promise<string> {
  const src = sharp(join(process.cwd(), "public/img/nbss", `${name}.webp`));
  const meta = await src.metadata();
  const scale = Math.max(w / meta.width!, h / meta.height!);
  const rw = Math.ceil(meta.width! * scale);
  const rh = Math.ceil(meta.height! * scale);
  const left = Math.round(Math.min(Math.max(fx * rw - w / 2, 0), rw - w));
  const top = Math.round(Math.min(Math.max(fy * rh - h / 2, 0), rh - h));
  const jpeg = await src
    .resize(rw, rh, { kernel: "lanczos3" })
    .extract({ left, top, width: w, height: h })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** The website as a QR code, in one colour on a clear ground. */
async function qr(dark: string): Promise<string> {
  const svg = await QRCode.toString(`https://${WEBSITE}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark, light: "#0000" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Lucide's paths (lucide-react 1.x), drawn as images: Satori has no icon font. */
const ICONS = {
  phone:
    '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  whatsapp:
    '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
} as const;
type IconName = keyof typeof ICONS;

function Icon({ name, size, color, stroke = 2 }: { name: IconName; size: number; color: string; stroke?: number }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={size} height={size} alt="" />;
}

/**
 * The Aronai band, the woven row of diamonds the whole identity is drawn from, at
 * card scale: `tile` px per repeat (36 on the 1200 px share cards).
 */
function Aronai({ width, tile = 90, ground, line, a, b }: { width: number; tile?: number; ground: string; line: string; a: string; b: string }) {
  const k = tile / 36;
  const h = Math.round(14 * k);
  const d = Math.round(10 * k);
  const border = Math.max(2, Math.round(1.5 * k));
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height: h,
        background: ground,
        borderTop: `${Math.round(k)}px solid ${line}`,
        borderBottom: `${Math.round(k)}px solid ${line}`,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: Math.ceil(width / tile) + 1 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: i * tile, top: 0, width: tile, height: h, display: "flex" }}>
          <div style={{ position: "absolute", left: 4 * k, top: 2 * k - k, width: d, height: d, border: `${border}px solid ${a}`, transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", left: 22 * k, top: 2 * k - k, width: d, height: d, border: `${border}px solid ${b}`, transform: "rotate(45deg)" }} />
          <div style={{ position: "absolute", left: 15 * k, top: 4 * k - k, width: 6 * k, height: 6 * k, background: a, transform: "rotate(45deg)" }} />
        </div>
      ))}
    </div>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────────────── */

type Assets = { logo: string };

function Logo({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="" />;
}

/** One line of contact: an icon in a disc, then the value. */
function Row({ icon, disc, color, size, children }: { icon: IconName; disc: string; color: string; size: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 1.55, height: size * 1.55, borderRadius: 999, background: disc, flexShrink: 0 }}>
        <Icon name={icon} size={size * 0.82} color={color} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginLeft: size * 0.6 }}>{children}</div>
    </div>
  );
}

/* ── 1. Daylight ────────────────────────────────────────────────────────── */

async function daylightFront({ logo }: Assets) {
  const PHOTO_W = 900;
  const BAND_H = 170;
  const img = await photo("batch-grass", PHOTO_W, CARD_H - BAND_H, 0.42, 0.5);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: CARD_W, height: CARD_H, background: PAPER, color: INK }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ position: "relative", display: "flex", width: PHOTO_W }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} width={PHOTO_W} height={CARD_H - BAND_H} alt="" />
          <div style={{ position: "absolute", right: 0, top: 0, width: 16, height: CARD_H - BAND_H, background: BRAND, display: "flex" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 100px 0 110px" }}>
          <Logo src={logo} size={240} />
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: "0.22em", color: BRAND_DEEP, marginTop: 52 }}>
            PRIVATE SECURITY AGENCY
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 112, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02, marginTop: 22 }}>
            <span>National Bodo</span>
            <span>Security Service</span>
          </div>
          <div style={{ display: "flex", width: 150, height: 12, borderRadius: 6, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DEEP})`, marginTop: 40 }} />
          <div style={{ display: "flex", fontSize: 54, fontWeight: 500, color: INK_DIM, marginTop: 36 }}>{site.tagline}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: BAND_H, padding: "0 100px", background: BRAND_DEEP, color: PAPER }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Icon name="shield" size={64} color={PAPER} />
          <span style={{ fontSize: 44, fontWeight: 500, marginLeft: 24, color: "#CDEBDD" }}>PSARA Licence No.</span>
          <span style={{ fontSize: 48, fontWeight: 700, marginLeft: 18, letterSpacing: "0.01em" }}>{site.psaraLicence}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 46, fontWeight: 700 }}>
          <Icon name="pin" size={56} color={PAPER} />
          <span style={{ marginLeft: 14 }}>Kokrajhar</span>
        </div>
      </div>
    </div>
  );
}

/** The four numbers two to a row, the WhatsApp line marked. */
function PhoneGrid({ size, color, tag, tagText = "WhatsApp", cell }: { size: number; color: string; tag: string; tagText?: string; cell: number }) {
  const rows = [PHONES.slice(0, 2), PHONES.slice(2, 4)];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex" }}>
          {row.map((p) => (
            <div key={p} style={{ display: "flex", alignItems: "center", width: cell, fontSize: size, fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.22, color }}>
              {p}
              {p === WHATSAPP ? (
                <span style={{ display: "flex", fontSize: size * 0.42, fontWeight: 700, color: tag, marginLeft: size * 0.25 }}>{tagText}</span>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

async function daylightBack({ logo }: Assets) {
  const code = await qr(INK);
  const ICON = 62;
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: CARD_W, height: CARD_H, background: PAPER, color: INK }}>
      <div style={{ display: "flex", flex: 1, padding: "92px 100px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Logo src={logo} size={150} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 34 }}>
              <span style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>NBSS</span>
              <span style={{ fontSize: 42, fontWeight: 500, color: INK_DIM, marginTop: 10 }}>Trained, police-verified guards, 24 × 7</span>
            </div>
          </div>
          <Row icon="phone" disc={MINT} color={BRAND_DEEP} size={ICON}>
            <PhoneGrid size={72} color={INK} tag={BRAND_DEEP} cell={560} />
          </Row>
          <Row icon="mail" disc={MINT} color={BRAND_DEEP} size={ICON}>
            <span style={{ fontSize: 60, fontWeight: 500 }}>{site.email}</span>
          </Row>
          <Row icon="pin" disc={MINT} color={BRAND_DEEP} size={ICON}>
            <span style={{ fontSize: 48, fontWeight: 500, color: INK_DIM, lineHeight: 1.3 }}>{site.postal[0]}</span>
            <span style={{ fontSize: 48, fontWeight: 500, color: INK_DIM, lineHeight: 1.3 }}>{site.postal[1]}</span>
          </Row>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: 420 }}>
          <div style={{ display: "flex", padding: 32, borderRadius: 40, background: MINT, border: `3px solid ${LINE}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code} width={300} height={300} alt="" />
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700, color: BRAND_DEEP, marginTop: 24 }}>
            <Icon name="globe" size={44} color={BRAND_DEEP} />
            <span style={{ marginLeft: 12 }}>{WEBSITE}</span>
          </div>
        </div>
      </div>

      <Aronai width={CARD_W} ground={MINT} line={LINE} a={BRAND_DEEP} b={BRAND} />
      <div style={{ display: "flex", height: 34, background: BRAND_DEEP }} />
    </div>
  );
}

/* ── 2. Night watch ─────────────────────────────────────────────────────── */

async function nightFront({ logo }: Assets) {
  const PHOTO_W = 1460;
  const img = await photo("stadium-night", PHOTO_W, CARD_H, 0.62, 0.55);
  return (
    <div style={{ position: "relative", display: "flex", width: CARD_W, height: CARD_H, background: NIGHT, color: PAPER }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} width={PHOTO_W} height={CARD_H} alt="" style={{ position: "absolute", right: 0, top: 0 }} />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: PHOTO_W,
          height: CARD_H,
          display: "flex",
          background: `linear-gradient(90deg, ${NIGHT} 0%, rgba(4,18,12,0.86) 26%, rgba(4,18,12,0.25) 62%, rgba(4,18,12,0.05) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: CARD_W,
          height: 520,
          display: "flex",
          background: "linear-gradient(180deg, rgba(4,18,12,0) 0%, rgba(4,18,12,0.85) 70%, rgba(4,18,12,0.95) 100%)",
        }}
      />

      <div style={{ position: "absolute", left: 100, top: 96, display: "flex" }}>
        <Logo src={logo} size={230} />
      </div>
      <div style={{ position: "absolute", right: 100, top: 100, display: "flex", alignItems: "center", padding: "16px 30px", borderRadius: 999, border: `3px solid rgba(226,169,60,0.7)`, background: "rgba(4,18,12,0.55)" }}>
        <Icon name="shield" size={48} color={GOLD} />
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: "0.14em", color: GOLD, marginLeft: 14 }}>PSARA LICENSED</span>
      </div>

      <div style={{ position: "absolute", left: 100, bottom: 100, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: "0.22em", color: GOLD }}>KOKRAJHAR · BTR · ASSAM</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 124, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0, marginTop: 24 }}>
          <span>National Bodo</span>
          <span>Security Service</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
          <div style={{ display: "flex", width: 110, height: 10, borderRadius: 5, background: GOLD }} />
          <span style={{ fontSize: 52, fontWeight: 500, color: MOSS, marginLeft: 30 }}>{site.tagline}</span>
        </div>
        <div style={{ display: "flex", fontSize: 38, fontWeight: 500, color: "#8FAE9E", marginTop: 30 }}>
          PSARA Licence No. {site.psaraLicence}
        </div>
      </div>
    </div>
  );
}

async function nightBack({ logo }: Assets) {
  const code = await qr(NIGHT);
  const ICON = 58;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: CARD_W,
        height: CARD_H,
        color: PAPER,
        background: `radial-gradient(circle at 85% 20%, ${NIGHT_2} 0%, ${NIGHT} 60%)`,
      }}
    >
      <Aronai width={CARD_W} tile={80} ground={NIGHT} line="#0B4830" a={GOLD} b={BRAND} />
      <div style={{ display: "flex", flex: 1, padding: "84px 100px 100px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: "0.22em", color: GOLD }}>CALL US · DESK OPEN 24 × 7</div>
            <div style={{ display: "flex", marginTop: 30 }}>
              <PhoneGrid size={86} color={PAPER} tag={GOLD} tagText="WA" cell={640} />
            </div>
          </div>
          <div style={{ display: "flex", width: 1260, height: 3, background: "rgba(185,211,197,0.18)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <Row icon="mail" disc="rgba(226,169,60,0.14)" color={GOLD} size={ICON}>
              <span style={{ fontSize: 58, fontWeight: 500 }}>{site.email}</span>
            </Row>
            <Row icon="pin" disc="rgba(226,169,60,0.14)" color={GOLD} size={ICON}>
              <span style={{ fontSize: 46, fontWeight: 500, color: MOSS }}>{site.postal.join(", ")}</span>
            </Row>
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 500, color: "#8FAE9E", letterSpacing: "0.02em" }}>
            Security guards · Lady guards · Supervisors · Events
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: 420 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", padding: 34, borderRadius: 40, background: PAPER }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={code} width={300} height={300} alt="" />
            </div>
            <span style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 26 }}>{WEBSITE}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Logo src={logo} size={120} />
            <span style={{ fontSize: 80, fontWeight: 700, letterSpacing: "-0.04em", marginLeft: 22 }}>NBSS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 3. Parade ──────────────────────────────────────────────────────────── */

async function paradeFront({ logo }: Assets) {
  const PHOTO_H = 690;
  const img = await photo("assembly-road", CARD_W, PHOTO_H, 0.5, 0.57);
  const LOGO = 330;
  const BAND_TILE = 90;
  const bandH = Math.round(14 * (BAND_TILE / 36)) + 2 * Math.round(BAND_TILE / 36);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", width: CARD_W, height: CARD_H, background: BRAND_DEEP, color: PAPER }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} width={CARD_W} height={PHOTO_H} alt="" />
      <Aronai width={CARD_W} tile={BAND_TILE} ground={MINT} line={LINE} a={BRAND_DEEP} b={BRAND} />
      <div style={{ display: "flex", flex: 1, background: `linear-gradient(135deg, ${BRAND_DEEP} 0%, #00583D 100%)` }} />

      <div style={{ position: "absolute", left: 100, top: PHOTO_H + bandH / 2 - LOGO / 2, display: "flex" }}>
        <Logo src={logo} size={LOGO} />
      </div>
      <div style={{ position: "absolute", left: 100 + LOGO + 60, top: PHOTO_H + bandH + 70, right: 100, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.0 }}>National Bodo Security Service</div>
        <div style={{ display: "flex", fontSize: 52, fontWeight: 500, color: "#CDEBDD", marginTop: 26 }}>{site.tagline}</div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 38, fontWeight: 500, color: "#A7D7C1", marginTop: 34 }}>
          <Icon name="shield" size={46} color="#A7D7C1" />
          <span style={{ marginLeft: 14 }}>PSARA Licence No. {site.psaraLicence}</span>
          <span style={{ margin: "0 20px" }}>·</span>
          <span>Kokrajhar, Assam</span>
        </div>
      </div>
    </div>
  );
}

async function paradeBack({ logo }: Assets) {
  const code = await qr(BRAND_DEEP);
  const ICON = 54;
  return (
    <div style={{ display: "flex", width: CARD_W, height: CARD_H, background: MINT, color: INK }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "100px 70px 100px 100px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: "0.2em", color: BRAND_DEEP }}>FOR A GUARD AT YOUR GATE, CALL</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
            {PHONES.map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", fontSize: 100, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.24, color: INK }}>
                {p}
                {p === WHATSAPP ? (
                  <span style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700, color: PAPER, background: BRAND, borderRadius: 999, padding: "8px 24px", marginLeft: 28 }}>
                    WhatsApp
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 500, color: BRAND_DEEP }}>Free site visit · Written quote · Desk open 24 × 7</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 900, height: CARD_H, background: `linear-gradient(160deg, ${BRAND_DEEP} 0%, #00583D 100%)`, color: PAPER, padding: "100px 100px 100px 90px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", padding: 24, borderRadius: 32, background: PAPER }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={code} width={270} height={270} alt="" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 44 }}>
            <Logo src={logo} size={140} />
            <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.04em", marginTop: 14 }}>NBSS</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <Row icon="globe" disc="rgba(255,255,255,0.14)" color={PAPER} size={ICON}>
            <span style={{ fontSize: 50, fontWeight: 700 }}>{WEBSITE}</span>
          </Row>
          <Row icon="mail" disc="rgba(255,255,255,0.14)" color={PAPER} size={ICON}>
            <span style={{ fontSize: 42, fontWeight: 500 }}>{site.email}</span>
          </Row>
          <Row icon="pin" disc="rgba(255,255,255,0.14)" color={PAPER} size={ICON}>
            <span style={{ fontSize: 40, fontWeight: 500, color: "#CDEBDD", lineHeight: 1.3 }}>{site.postal[0]}</span>
            <span style={{ fontSize: 40, fontWeight: 500, color: "#CDEBDD", lineHeight: 1.3 }}>{site.postal[1]}</span>
          </Row>
        </div>
      </div>
    </div>
  );
}

/* ── Rendering ──────────────────────────────────────────────────────────── */

const SIDES: Record<DesignId, Record<Side, (a: Assets) => Promise<React.ReactElement>>> = {
  daylight: { front: daylightFront, back: daylightBack },
  night: { front: nightFront, back: nightBack },
  parade: { front: paradeFront, back: paradeBack },
};

export function isDesign(value: string): value is DesignId {
  return DESIGNS.some((d) => d.id === value);
}

/** One side of one design, as a 2100 × 1200 PNG. */
export async function renderCard(design: DesignId, side: Side): Promise<Buffer> {
  const { logoSrc, fonts } = await ogAssets();
  const element = await SIDES[design][side]({ logo: logoSrc });
  const res = new ImageResponse(element, { width: CARD_W, height: CARD_H, fonts });
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Both sides of one design as a two-page PDF the size of the card (3.5 × 2 in),
 * front first, the way print shops take visiting cards. Each page is one JPEG at
 * 600 dpi; the file is written by hand because it is nothing more than that.
 */
export async function renderCardPdf(design: DesignId): Promise<Buffer> {
  const pages = await Promise.all(
    (["front", "back"] as const).map(async (side) =>
      sharp(await renderCard(design, side)).flatten({ background: "#ffffff" }).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer(),
    ),
  );
  return jpegPdf(pages, CARD_W, CARD_H, 252, 144);
}

/** A PDF of full-page JPEGs, each `pw × ph` points. */
function jpegPdf(jpegs: Buffer[], w: number, h: number, pw: number, ph: number): Buffer {
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Buffer | string) => {
    const buf = typeof b === "string" ? Buffer.from(b, "binary") : b;
    parts.push(buf);
    length += buf.length;
  };
  const object = (n: number, body: (Buffer | string)[]) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  // 1 catalog, 2 pages; then per page: page, contents, image.
  const kids = jpegs.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, [`<< /Type /Pages /Kids [${kids}] /Count ${jpegs.length} >>`]);
  jpegs.forEach((jpeg, i) => {
    const page = 3 + i * 3;
    const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    object(page, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`,
    ]);
    object(page + 1, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
    object(page + 2, [
      `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      jpeg,
      "\nendstream",
    ]);
  });

  const xref = length;
  const count = 3 + jpegs.length * 3;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}

/** One side as a PNG data URL `width` px wide, for the share card (/og/card). */
export async function cardPngDataUrl(design: DesignId, side: Side, width: number): Promise<string> {
  const png = await sharp(await renderCard(design, side)).resize({ width }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
