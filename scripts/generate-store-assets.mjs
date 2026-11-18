/**
 * The Google Play listing's graphics, from the same logo as the app icon
 * (apps/web/public/logo/NBSS.png), into store/play/:
 *
 *   icon-512.png          512 × 512, the listing icon (Play rounds the corners itself)
 *   feature-1024x500.png  the banner across the top of the listing
 *
 * Screenshots are taken from a phone, not drawn here: see store/play/README.md.
 *
 *   pnpm store:assets
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile } from "node:fs/promises";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "apps", "web", "public", "logo", "NBSS.png");
const OUT = path.join(ROOT, "store", "play");
await mkdir(OUT, { recursive: true });

// Icon: the badge on white, inset so Play's rounded mask never clips the shield.
const badge = await sharp(SRC).resize(430, 430, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
const icon = await sharp({ create: { width: 512, height: 512, channels: 4, background: "#ffffff" } })
  .composite([{ input: badge, gravity: "center" }])
  .png()
  .toBuffer();
await sharp(icon)
  .flatten({ background: "#ffffff" })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "icon-512.png"));

// Feature graphic: the app's green gradient, the badge on the left, the name and what it does.
const logo = (await readFile(SRC)).toString("base64");
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#009164"/>
      <stop offset="1" stop-color="#004d36"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="900" cy="-40" r="260" fill="#ffffff" fill-opacity="0.06"/>
  <circle cx="980" cy="520" r="200" fill="#34d399" fill-opacity="0.10"/>
  <image href="data:image/png;base64,${logo}" x="64" y="70" width="360" height="360"/>
  <text x="460" y="205" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="58" font-weight="700" fill="#ffffff">NBSS Kokrajhar</text>
  <text x="462" y="262" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="27" font-weight="500" fill="#d1fae5">Duty, attendance and SOS</text>
  <text x="462" y="298" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="27" font-weight="500" fill="#d1fae5">for NBSS guards, supervisors and clients</text>
  <rect x="462" y="330" width="72" height="5" rx="2.5" fill="#34d399"/>
</svg>`;
await sharp(Buffer.from(svg)).flatten({ background: "#009164" }).png({ compressionLevel: 9 }).toFile(path.join(OUT, "feature-1024x500.png"));

console.log(`Wrote ${path.relative(ROOT, OUT)}/icon-512.png and feature-1024x500.png`);
