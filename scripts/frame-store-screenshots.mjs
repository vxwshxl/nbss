/**
 * Google Play screenshots, framed: each raw screen from store/play/raw/ set in a
 * phone or tablet frame on the app's green, with a headline above it, into
 * store/play/screenshots/.
 *
 *   phone   1080 × 1920 (9:16)       from raw/phone-*.png  (1080 × 2400 screens)
 *   tablet  1600 × 2560 (10:16)      from raw/tablet-*.png (1600 × 2560 screens)
 *
 *   pnpm store:screenshots
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readdir } from "node:fs/promises";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "store", "play", "raw");
const OUT = path.join(ROOT, "store", "play", "screenshots");
await mkdir(OUT, { recursive: true });

/** Headline and one line under it, per raw file (by name without the size prefix). */
const COPY = {
  "01-office-guard-route": ["Every guard, live", "Tap one: their route, battery and direction"],
  "02-office-site": ["Each site at a glance", "Who is on duty, inside and posted"],
  "03-guard-duty": ["Check in at the gate", "The app confirms you are inside your site"],
  "04-guard-sos": ["Help in three seconds", "Hold SOS: your team and the office are alerted"],
  "05-supervisor-live": ["Your site, right now", "Inside, outside and no signal at a glance"],
  "06-supervisor-today": ["Today's duties, sorted", "Not arrived, on duty and starting later"],
  "07-client-sites": ["Your guards, on the map", "On duty now, verified at your boundary"],
  "08-client-book": ["Book guards in minutes", "Tell us what you need; we call you back"],
  "09-office-sos-history": ["Every SOS, on the map", "Red open · blue coming · green resolved · grey false"],
};

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function background(W, H, title, sub, s) {
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#009164"/><stop offset="1" stop-color="#00422f"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <circle cx="${W * 0.92}" cy="${H * 0.04}" r="${W * 0.3}" fill="#fff" fill-opacity="0.06"/>
  <circle cx="${W * 0.04}" cy="${H * 0.62}" r="${W * 0.26}" fill="#34d399" fill-opacity="0.09"/>
  <text x="${W / 2}" y="${118 * s}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${62 * s}" fill="#fff">${esc(title)}</text>
  <text x="${W / 2}" y="${178 * s}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="${31 * s}" fill="#d1fae5">${esc(sub)}</text>
  <rect x="${W / 2 - 36 * s}" y="${206 * s}" width="${72 * s}" height="${5 * s}" rx="${2.5 * s}" fill="#34d399"/>
</svg>`);
}

/** A device body: dark rounded slab, side buttons, and (phone) the island over the screen. */
function body(w, h, r, kind) {
  const buttons =
    kind === "phone"
      ? `<rect x="-4" y="${h * 0.2}" width="6" height="${h * 0.06}" rx="3" fill="#1f2937"/><rect x="-4" y="${h * 0.28}" width="6" height="${h * 0.1}" rx="3" fill="#1f2937"/><rect x="${w - 2}" y="${h * 0.25}" width="6" height="${h * 0.12}" rx="3" fill="#1f2937"/>`
      : `<rect x="${w * 0.78}" y="-4" width="${w * 0.08}" height="6" rx="3" fill="#1f2937"/>`;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${w + 8}" height="${h + 8}" viewBox="-4 -4 ${w + 8} ${h + 8}">
  <defs><filter id="d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-opacity="0.45"/></filter></defs>
  ${buttons}
  <rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="#0b0f14" filter="url(#d)"/>
  <rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="${r - 3}" fill="none" stroke="#2b3440" stroke-width="2"/>
</svg>`);
}

async function frame(file, kind) {
  const name = file.replace(/^(phone|tablet)-/, "").replace(/\.png$/, "");
  const [title, sub] = COPY[name] ?? [name, ""];
  const phone = kind === "phone";
  const W = phone ? 1080 : 1600;
  const H = phone ? 1920 : 2560;
  const s = phone ? 1 : 1.45;
  // Screen size, bezel and corner radii: an iPhone-like phone, an iPad-like tablet.
  const screenH = phone ? 1500 : 1960;
  const meta = await sharp(path.join(RAW, file)).metadata();
  const screenW = Math.round((screenH * meta.width) / meta.height);
  const bezel = phone ? 22 : 34;
  const rScreen = phone ? 70 : 34;
  const bodyW = screenW + bezel * 2;
  const bodyH = screenH + bezel * 2;
  const x = Math.round((W - bodyW) / 2);
  const y = Math.round(phone ? 300 : 420);

  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${screenW}" height="${screenH}"><rect width="${screenW}" height="${screenH}" rx="${rScreen}" fill="#fff"/></svg>`);
  const screen = await sharp(path.join(RAW, file)).resize(screenW, screenH).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const overlay = phone
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${screenW}" height="60"><rect x="${screenW / 2 - 85}" y="14" width="170" height="44" rx="22" fill="#000"/></svg>`)
    : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="6" fill="#1f2937"/><circle cx="10" cy="10" r="3" fill="#0f172a"/></svg>`);

  await sharp(background(W, H, title, sub, s))
    .composite([
      { input: body(bodyW, bodyH, rScreen + bezel, kind), left: x - 4, top: y - 4 },
      { input: screen, left: x + bezel, top: y + bezel },
      phone ? { input: overlay, left: x + bezel, top: y + bezel } : { input: overlay, left: Math.round(W / 2 - 10), top: y + Math.round(bezel / 2) - 10 },
    ])
    .flatten({ background: "#009164" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
  return file;
}

const files = (await readdir(RAW)).filter((f) => /^(phone|tablet)-.*\.png$/.test(f)).sort();
for (const f of files) console.log("framed", await frame(f, f.startsWith("phone") ? "phone" : "tablet"));
