/**
 * Google Play screenshots, as one continuous panorama per device size, cut into frames.
 *
 * Built on what the best-converting store sets do: a short benefit headline (under six
 * words, large, left-aligned, no labels or badges), one consistent system across the
 * set, the real app large and running off the bottom edge, and on a few frames one
 * piece of real UI pulled out of the screen and enlarged ("breakout"), never a drawn
 * callout. The background runs on across frames, so side by side in the store they read
 * as one picture: deep green with faint topographic contours and a patrol route
 * threading from phone to phone.
 *
 *   phone   1080 × 1920 each   from raw/phone-*.png   (1080 × 2400 screens)
 *   tablet  1600 × 2560 each   from raw/tablet-*.png  (1600 × 2560 screens)
 *
 * Rendered by Google Chrome from HTML (Geist, the app's own face) and cut with sharp.
 *
 *   pnpm store:screenshots
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import sharp from "sharp";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "store", "play", "raw");
const OUT = path.join(ROOT, "store", "play", "screenshots");
const FONT = pathToFileURL(path.join(ROOT, "apps", "web", "public", "fonts", "geist-sans-variable.woff2")).href;
const LOGO = pathToFileURL(path.join(ROOT, "apps", "web", "public", "logo", "nbss-256.webp")).href;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * The story, in store order. `a` is the headline's first line, `b` its second (in the
 * accent). `shift` moves the phone off centre (fraction of the frame) to make room for
 * a breakout; `out` is that breakout: a region [x, y, w, h] of the raw screen, enlarged
 * beside the phone (a tablet without its own region borrows the phone's).
 */
const FRAMES = [
  { raw: "01-office-guard-route", a: "Every guard.", b: "Live, on one map.", shift: 0 },
  { raw: "04-guard-sos", a: "Help arrives", b: "in three seconds.", shift: -0.05,
    out: { phone: [846, 1980, 180, 180], tablet: null, at: 0.6, side: "right", scale: 1.9, round: true } },
  { raw: "03-guard-duty", a: "Check in", b: "only at the gate.", shift: 0 },
  { raw: "05-supervisor-live", a: "See who left", b: "their post.", shift: 0 },
  { raw: "02-office-site", a: "Every site,", b: "at a glance.", shift: 0 },
  { raw: "06-supervisor-today", a: "Today's duties,", b: "already sorted.", shift: 0 },
  { raw: "07-client-sites", a: "See your guards,", b: "live.", shift: 0 },
  { raw: "08-client-book", a: "Book guards", b: "in minutes.", shift: 0 },
  { raw: "09-office-sos-history", a: "Every SOS,", b: "on the record.", shift: 0 },
];

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(pts) {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function panorama(kind, frames) {
  const phone = kind === "phone";
  const W = phone ? 1080 : 1600;
  const H = phone ? 1920 : 2560;
  const N = frames.length;
  const TW = W * N;
  const s = phone ? 1 : 1.46;

  // The phone: large, the top of the app in view, running off the bottom edge.
  const screenW = phone ? 760 : 1200;
  const rawW = phone ? 1080 : 1600;
  const rawH = phone ? 2400 : 2560;
  const k = screenW / rawW;
  const screenH = Math.round(rawH * k);
  const bezel = phone ? 15 : 24;
  const radius = phone ? 92 : 50;
  const top = phone ? 610 : 820;

  // Topographic contours across the whole panorama, faint, and the patrol route.
  const rnd = (i) => {
    const v = Math.sin(i * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  const contours = [];
  for (let i = 0; i < 26; i++) {
    const base = (H / 26) * i + 20;
    const f1 = 0.0011 + rnd(i) * 0.0009;
    const f2 = 0.0037 + rnd(i + 7) * 0.002;
    const a1 = 38 + rnd(i + 3) * 60;
    const a2 = 10 + rnd(i + 5) * 16;
    const ph = rnd(i + 9) * 6;
    const pts = [];
    for (let x = -40; x <= TW + 40; x += 60) pts.push([x, base + a1 * Math.sin(x * f1 + ph) + a2 * Math.sin(x * f2 + ph * 2)]);
    contours.push(`<path d="${smooth(pts)}"/>`);
  }
  const routePts = [];
  for (let f = 0; f <= N; f++) {
    routePts.push([f * W - W * 0.08, top + screenH * (f % 2 ? 0.22 : 0.48)]);
    routePts.push([f * W + W * 0.5, top + screenH * (f % 2 ? 0.58 : 0.12)]);
  }
  const route = smooth(routePts);
  const nodes = routePts
    .filter((_, i) => i % 2 === 0)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${9 * s}" fill="#04140e" stroke="#6ee7b7" stroke-width="${4 * s}"/>`)
    .join("");

  // A city under the map: a street grid set at an angle, broken into blocks, with a
  // few arterial roads sweeping through it.
  const streets = [];
  const step = 92 * s;
  for (let x = -H; x < TW + H; x += step) {
    for (let y = -H * 0.5; y < H * 1.5; y += step * (2 + Math.floor(rnd(x + y) * 3))) {
      if (rnd(x * 0.7 + y) < 0.32) continue;
      streets.push(`<path d="M ${x} ${y} L ${x} ${y + step * (1 + Math.floor(rnd(x - y) * 3))}"/>`);
    }
  }
  for (let y = -H * 0.5; y < H * 1.5; y += step) {
    for (let x = -H; x < TW + H; x += step * (2 + Math.floor(rnd(y + x * 0.3) * 4))) {
      if (rnd(y * 1.3 + x) < 0.32) continue;
      streets.push(`<path d="M ${x} ${y} L ${x + step * (1 + Math.floor(rnd(y - x) * 4))} ${y}"/>`);
    }
  }
  const arterials = [0, 1, 2].map((j) => {
    const pts = [];
    for (let x = -100; x <= TW + 100; x += W / 3) pts.push([x, H * (0.18 + 0.3 * j) + 140 * s * Math.sin(x * 0.0011 + j * 2)]);
    return `<path d="${smooth(pts)}"/>`;
  });

  // Per frame: a geofence with a radar sweep in the open space, coordinates, guards.
  const ll = (i) => `${(26.385 + rnd(i + 40) * 0.035).toFixed(4)}° N  ${(90.25 + rnd(i + 80) * 0.045).toFixed(4)}° E`;
  const hud = [];
  const radars = [];
  frames.forEach((f, i) => {
    const x0 = i * W;
    // The fence sits behind the phone's edge, half of it showing, so the map runs on
    // behind the device; its readout is a quiet line in the frame's top corner.
    const edge = screenW / 2 + bezel;
    const fx = x0 + W / 2 + f.shift * W + (i % 2 ? edge : -edge);
    const fy = top + screenH * (i % 2 ? 0.5 : 0.3);
    const r = 190 * s;
    hud.push(
      `<circle cx="${fx}" cy="${fy}" r="${r}" class="fence"/>` +
        `<circle cx="${fx}" cy="${fy}" r="${r * 0.62}" class="ring"/>` +
        `<circle cx="${fx}" cy="${fy}" r="${r * 0.28}" class="ring"/>` +
        `<path d="M ${fx - r - 18 * s} ${fy} H ${fx - r + 14 * s} M ${fx + r - 14 * s} ${fy} H ${fx + r + 18 * s} M ${fx} ${fy - r - 18 * s} V ${fy - r + 14 * s} M ${fx} ${fy + r - 14 * s} V ${fy + r + 18 * s}" class="tick"/>` +
        `<text x="${x0 + W - 80 * s}" y="${(i === 0 ? 118 : 74) * s}" class="mono" text-anchor="end">GEOFENCE ${String(i + 1).padStart(2, "0")} · ${Math.round(r / s / 1.6)} M</text>` +
        `<text x="${x0 + W - 80 * s}" y="${(i === 0 ? 146 : 102) * s}" class="mono dim" text-anchor="end">${ll(i)}</text>`,
    );
    radars.push(`<div class="radar" style="left:${fx - r}px;top:${fy - r}px;width:${r * 2}px;height:${r * 2}px;--a:${Math.round(rnd(i + 3) * 360)}deg"></div>`);
  });
  // Guards on the route: a dot with fading rings, and a coordinate tag on some.
  const guardsOnRoute = routePts
    .filter((_, i) => i % 2 === 1)
    .map(([x, y], i) => {
      const tag = i % 2 === 0 ? `<text x="${x + 26 * s}" y="${y - 22 * s}" class="mono dim">${ll(i + 20)}</text>` : "";
      return `<circle cx="${x}" cy="${y}" r="${46 * s}" fill="#34d399" fill-opacity="0.05"/><circle cx="${x}" cy="${y}" r="${26 * s}" fill="#34d399" fill-opacity="0.12"/><circle cx="${x}" cy="${y}" r="${10 * s}" fill="#34d399" stroke="#04140e" stroke-width="${4 * s}"/>${tag}`;
    })
    .join("");

  // The status bar the screen starts with, as a phone or tablet shows it; the app
  // begins below it (below the Dynamic Island on a phone), not under it.
  const sb = phone ? Math.round((54 / 393) * screenW) : Math.round((24 / 834) * screenW);
  const icons = (h) =>
    `<svg height="${h}" viewBox="0 0 80 14"><g fill="#0b0b0c"><rect x="0" y="9" width="3.2" height="5" rx="1"/><rect x="5" y="6.5" width="3.2" height="7.5" rx="1"/><rect x="10" y="3.8" width="3.2" height="10.2" rx="1"/><rect x="15" y="1" width="3.2" height="13" rx="1"/>` +
    `<path d="M31.5 3.3a10.6 10.6 0 0 1 7.6 3.1l1.4-1.5a12.7 12.7 0 0 0-18 0l1.4 1.5a10.6 10.6 0 0 1 7.6-3.1zm0 3.9a6.8 6.8 0 0 1 4.8 2l1.4-1.5a8.9 8.9 0 0 0-12.4 0l1.4 1.5a6.8 6.8 0 0 1 4.8-2zm0 3.9a3 3 0 0 1 2.1.9l-2.1 2.2-2.1-2.2a3 3 0 0 1 2.1-.9z"/>` +
    `<rect x="47.5" y="1.5" width="25" height="11" rx="3.4" fill="none" stroke="#0b0b0c" stroke-opacity="0.4"/><rect x="49.5" y="3.5" width="18" height="7" rx="1.8"/><rect x="73.6" y="5" width="1.6" height="4" rx="0.8" fill-opacity="0.4"/></g></svg>`;
  const statusBar = phone
    ? `<div class="sb" style="height:${sb}px;padding:0 ${screenW * 0.085}px 0 ${screenW * 0.13}px"><b style="font-size:${Math.round(sb * 0.33)}px">9:41</b>${icons(Math.round(sb * 0.2))}</div>`
    : `<div class="sb" style="height:${sb}px;padding:0 ${sb * 0.9}px"><b style="font-size:${Math.round(sb * 0.5)}px">9:41 <span>Wed 18 Nov</span></b>${icons(Math.round(sb * 0.42))}</div>`;

  const shots = frames
    .map((f, i) => {
      const x0 = i * W;
      const cx = x0 + W / 2 + f.shift * W;
      const img = pathToFileURL(path.join(RAW, `${kind}-${f.raw}.png`)).href;
      const brand = i === 0 ? `<div class="brand" style="left:${x0 + 92 * s}px;top:${96 * s}px"><img src="${LOGO}"><span>NBSS Kokrajhar</span></div>` : "";
      let out = "";
      const fromPhone = kind === "tablet" && f.out && !f.out.tablet;
      const crop = f.out ? (fromPhone ? f.out.phone : f.out[kind]) : null;
      if (crop) {
        // A region of the real screen, enlarged and lifted out beside the phone.
        const srcW = fromPhone ? 1080 : rawW;
        const srcH = fromPhone ? 2400 : rawH;
        const src = fromPhone ? pathToFileURL(path.join(RAW, `phone-${f.raw}.png`)).href : img;
        const kk = (fromPhone ? (760 / 1080) * s : k) * f.out.scale;
        const [rx, ry, rw, rh] = crop;
        const w = rw * kk;
        const h = rh * kk;
        const left = f.out.side === "left" ? cx - screenW / 2 - bezel - 64 * s : cx + screenW / 2 + bezel + 64 * s - w;
        out = `<div class="out${f.out.round ? " round" : ""}" style="left:${left}px;top:${top + screenH * f.out.at}px;width:${w}px;height:${h}px;background-image:url('${src}');background-size:${srcW * kk}px ${srcH * kk}px;background-position:-${rx * kk}px -${ry * kk}px"></div>`;
      }
      return `${brand}
<h1 style="left:${x0 + 92 * s}px;top:${(i === 0 ? 200 : 150) * s}px">${f.a}<span>${f.b}</span></h1>
<div class="glow" style="left:${cx - screenW * 0.9}px;top:${top - 120 * s}px;width:${screenW * 1.8}px;height:${screenH}px"></div>
<div class="device" style="left:${cx - screenW / 2 - bezel}px;top:${top}px"><div class="screen" style="width:${screenW}px;height:${screenH}px">${statusBar}<img src="${img}" style="width:${screenW}px;height:${screenH}px"></div>${phone ? '<i class="island"></i>' : '<i class="cam"></i>'}</div>
${out}`;
    })
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${TW}px; height: ${H}px; overflow: hidden; }
body { position: relative; font-family: Geist, system-ui, sans-serif; background: #04140e; }
.sky { position: absolute; inset: 0; background:
  radial-gradient(ellipse ${W * 0.9}px ${H * 0.5}px at 0% 0%, rgba(0,145,100,0.30), transparent 70%),
  linear-gradient(180deg, #062419 0%, #04140e 46%, #031009 100%); }
svg.map { position: absolute; left: 0; top: 0; }
.contours path { fill: none; stroke: #6ee7b7; stroke-opacity: 0.04; stroke-width: ${1.4 * s}; }
.streets path { fill: none; stroke: #6ee7b7; stroke-opacity: 0.07; stroke-width: ${2.2 * s}; stroke-linecap: round; }
.arterials path { fill: none; stroke: #6ee7b7; stroke-opacity: 0.09; stroke-width: ${9 * s}; stroke-linecap: round; }
.fence { fill: rgba(52,211,153,0.05); stroke: #34d399; stroke-opacity: 0.55; stroke-width: ${2.5 * s}; stroke-dasharray: ${10 * s} ${8 * s}; }
.ring { fill: none; stroke: #6ee7b7; stroke-opacity: 0.18; stroke-width: ${1.5 * s}; }
.tick { stroke: #6ee7b7; stroke-opacity: 0.7; stroke-width: ${2.5 * s}; }
.mono { font-family: "SF Mono", Menlo, ui-monospace, monospace; font-size: ${19 * s}px; letter-spacing: 0.08em; fill: #6ee7b7; fill-opacity: 0.75; }
.mono.dim { fill-opacity: 0.45; font-size: ${17 * s}px; }
.radar { position: absolute; border-radius: 50%; background: conic-gradient(from var(--a), rgba(52,211,153,0.42), rgba(52,211,153,0) 70deg, transparent 360deg); }
.hudgrid { position: absolute; inset: 0; opacity: 0.05; background-image: linear-gradient(#6ee7b7 1px, transparent 1px), linear-gradient(90deg, #6ee7b7 1px, transparent 1px); background-size: ${28 * s}px ${28 * s}px; }
.route { fill: none; stroke: #34d399; stroke-width: ${5 * s}; stroke-linecap: round; stroke-dasharray: ${2 * s} ${16 * s}; opacity: 0.9; }
.route-glow { fill: none; stroke: #10b981; stroke-width: ${26 * s}; opacity: 0.12; filter: blur(${8 * s}px); }
.glow { position: absolute; border-radius: 50%; background: radial-gradient(closest-side, rgba(16,185,129,0.34), rgba(16,185,129,0) 100%); }
h1 { position: absolute; color: #fff; font-size: ${96 * s}px; line-height: 0.98; font-weight: 720; letter-spacing: -0.045em; }
h1 span { display: block; color: #6ee7b7; }
.brand { position: absolute; display: flex; align-items: center; gap: ${18 * s}px; color: #d1fae5; font-size: ${34 * s}px; font-weight: 600; letter-spacing: -0.02em; }
.brand img { width: ${64 * s}px; height: ${64 * s}px; object-fit: contain; }
.device { position: absolute; padding: ${bezel}px; border-radius: ${radius + bezel}px; background: #050607;
  box-shadow: inset 0 0 0 ${1.5 * s}px #2d333b, 0 0 0 ${2 * s}px #3f4650, 0 ${60 * s}px ${140 * s}px rgba(0,0,0,0.7); }
.screen { position: relative; overflow: hidden; border-radius: ${radius}px; background: #fff; }
.screen img { display: block; }
.sb { display: flex; align-items: center; justify-content: space-between; background: #fff; color: #0b0b0c; }
.sb b { font-weight: 600; letter-spacing: -0.01em; font-family: -apple-system, "SF Pro Text", Geist, sans-serif; }
.sb b span { font-weight: 500; margin-left: 0.4em; }
.island { position: absolute; top: ${bezel + Math.round((11 / 393) * screenW)}px; left: 50%; transform: translateX(-50%); width: ${Math.round((126 / 393) * screenW)}px; height: ${Math.round((37 / 393) * screenW)}px; border-radius: 99px; background: #000; }
.cam { position: absolute; top: ${bezel / 2 - 5}px; left: 50%; width: 10px; height: 10px; border-radius: 50%; background: #1f2937; }
.out { position: absolute; border-radius: ${30 * s}px; background-repeat: no-repeat; background-color: #fff;
  box-shadow: 0 0 0 ${1.5 * s}px rgba(255,255,255,0.6), 0 ${40 * s}px ${90 * s}px rgba(0,0,0,0.55), 0 ${8 * s}px ${20 * s}px rgba(0,0,0,0.3); }
.out.round { border-radius: 50%; background-color: transparent; box-shadow: 0 ${30 * s}px ${70 * s}px rgba(185,28,28,0.55), 0 0 0 ${16 * s}px rgba(220,38,38,0.18), 0 0 0 ${40 * s}px rgba(220,38,38,0.08); }
</style></head><body>
<div class="sky"></div>
<div class="hudgrid"></div>
<svg class="map" width="${TW}" height="${H}" viewBox="0 0 ${TW} ${H}">
  <g class="contours">${contours.join("")}</g>
  <g class="streets" transform="rotate(-14 ${TW / 2} ${H / 2})">${streets.join("")}</g>
  <g class="arterials">${arterials.join("")}</g>
</svg>
${radars.join("")}
<svg class="map" width="${TW}" height="${H}" viewBox="0 0 ${TW} ${H}">
  ${hud.join("")}
  <path class="route-glow" d="${route}"/><path class="route" d="${route}"/>${nodes}${guardsOnRoute}
</svg>
${shots}
</body></html>`;
}

await mkdir(OUT, { recursive: true });
for (const f of await readdir(OUT)) if (f.endsWith(".png")) await rm(path.join(OUT, f));
const tmp = await mkdtemp(path.join(os.tmpdir(), "nbss-shots-"));
try {
  for (const kind of ["phone", "tablet"]) {
    const have = new Set(await readdir(RAW));
    const frames = FRAMES.filter((f) => have.has(`${kind}-${f.raw}.png`));
    const [W, H] = kind === "phone" ? [1080, 1920] : [1600, 2560];
    const html = path.join(tmp, `${kind}.html`);
    const wide = path.join(tmp, `${kind}.png`);
    await writeFile(html, panorama(kind, frames));
    await run(
      CHROME,
      ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--force-device-scale-factor=1", `--window-size=${W * frames.length},${H}`, "--virtual-time-budget=5000", `--screenshot=${wide}`, pathToFileURL(html).href],
      { maxBuffer: 1 << 26 },
    );
    for (let i = 0; i < frames.length; i++) {
      const name = `${kind}-${String(i + 1).padStart(2, "0")}.png`;
      await sharp(wide).extract({ left: i * W, top: 0, width: W, height: H }).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
      console.log("frame", name, "←", frames[i].raw);
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
