/**
 * Google Play screenshots: each raw screen from store/play/raw/ laid out as a store
 * image (who it is for, a headline with an accent, the screen in a device frame, and
 * one callout naming the feature), rendered by Chrome into store/play/screenshots/.
 *
 *   phone   1080 × 1920 (9:16)   from raw/phone-*.png   (1080 × 2400 screens)
 *   tablet  1600 × 2560 (10:16)  from raw/tablet-*.png  (1600 × 2560 screens)
 *
 * Laid out in HTML rather than drawn, for the type: Geist (the app's own face, from
 * the website's fonts) with a serif italic accent, real shadows and the device frame.
 * Needs Google Chrome installed; nothing else.
 *
 *   pnpm store:screenshots
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "store", "play", "raw");
const OUT = path.join(ROOT, "store", "play", "screenshots");
const FONT = pathToFileURL(path.join(ROOT, "apps", "web", "public", "fonts", "geist-sans-variable.woff2")).href;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Per screen: who it is for, the headline (the accent in italic serif), and one
 * callout that names what the screen shows. Callouts say only what the screen does.
 */
const COPY = {
  "01-office-guard-route": { who: "For the office", lead: "Every guard,", accent: "live.", note: { icon: "route", text: "Route, battery and direction", tone: "blue" }, at: 0.07, side: "left" },
  "02-office-site": { who: "For the office", lead: "Each site,", accent: "at a glance.", note: { icon: "shield", text: "On duty · inside · posted", tone: "green" }, at: 0.07, side: "left" },
  "03-guard-duty": { who: "For guards", lead: "Check in", accent: "at the gate.", note: { icon: "check", text: "Inside the boundary", tone: "green" }, at: 0.15, side: "left" },
  "04-guard-sos": { who: "For guards", lead: "Help in", accent: "three seconds.", note: { icon: "sos", text: "Hold SOS · everyone is alerted", tone: "red" }, at: 0.13, side: "right" },
  "05-supervisor-live": { who: "For supervisors", lead: "Your site,", accent: "right now.", note: { icon: "alert", text: "Outside their site · 224 m", tone: "amber" }, at: 0.085, side: "left" },
  "06-supervisor-today": { who: "For supervisors", lead: "Today's duties,", accent: "sorted.", note: { icon: "clock", text: "Not arrived · on duty · later", tone: "violet" }, at: 0.075, side: "right" },
  "07-client-sites": { who: "For clients", lead: "Your guards,", accent: "on the map.", note: { icon: "check", text: "Verified at your boundary", tone: "green" }, at: 0.09, side: "left" },
  "08-client-book": { who: "For clients", lead: "Book guards", accent: "in minutes.", note: { icon: "phone", text: "We call you back to confirm", tone: "green" }, at: 0.86, side: "right" },
  "09-office-sos-history": { who: "For the office", lead: "Every SOS,", accent: "on the map.", note: { icon: "legend" }, at: 0.2, side: "right" },
};

const TONE = { green: "#059669", blue: "#2563eb", red: "#dc2626", amber: "#d97706", violet: "#7c3aed" };

// Lucide-style strokes, so the callouts match the app's icons.
const ICON = {
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  sos: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.93 4.93.71.71"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
};

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(kind, shot, c) {
  const phone = kind === "phone";
  const W = phone ? 1080 : 1600;
  const H = phone ? 1920 : 2560;
  // Type, the device and the callout, sized for each canvas.
  const s = phone ? 1 : 1.42;
  const screenW = phone ? 620 : 1120;
  const screenH = phone ? Math.round((620 * 2400) / 1080) : Math.round((1120 * 2560) / 1600);
  const bezel = phone ? 16 : 26;
  const radius = phone ? 78 : 46;
  const top = phone ? 470 : 640;

  const legend = [
    ["#dc2626", "Open"],
    ["#2563eb", "Help coming"],
    ["#16a34a", "Resolved"],
    ["#94a3b8", "False alarm"],
  ];
  const note =
    c.note.icon === "legend"
      ? `<div class="note legend">${legend.map(([col, t]) => `<span><i style="background:${col}"></i>${t}</span>`).join("")}</div>`
      : `<div class="note"><b style="background:${TONE[c.note.tone]}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[c.note.icon]}</svg></b><span>${esc(c.note.text)}</span></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url("${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
body {
  font-family: Geist, system-ui, sans-serif; color: #fff; position: relative;
  background:
    radial-gradient(ellipse 70% 45% at 50% 62%, rgba(52, 211, 153, 0.28), transparent 70%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(255, 255, 255, 0.10), transparent 70%),
    linear-gradient(165deg, #036b4c 0%, #01462f 55%, #00301f 100%);
}
/* The fine grid of the reference layouts, faint. */
.grid { position: absolute; inset: 0; opacity: 0.09;
  background-image: linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px);
  background-size: ${54 * s}px ${54 * s}px;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 78%); }
/* A sweep of the accent behind the device. */
.sweep { position: absolute; left: -15%; right: -15%; top: ${top + screenH * 0.42}px; height: ${260 * s}px;
  background: linear-gradient(90deg, rgba(52,211,153,0) 0%, rgba(52,211,153,0.55) 35%, rgba(167,243,208,0.6) 60%, rgba(52,211,153,0) 100%);
  transform: rotate(-9deg); border-radius: 50%; filter: blur(${2 * s}px); }
header { position: absolute; top: ${(phone ? 92 : 120)}px; left: 0; right: 0; text-align: center; }
.who { display: inline-flex; align-items: center; gap: ${10 * s}px; padding: ${10 * s}px ${22 * s}px; border-radius: 999px;
  background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22);
  font-size: ${24 * s}px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #d1fae5; }
.who i { width: ${10 * s}px; height: ${10 * s}px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 ${4 * s}px rgba(52,211,153,0.25); }
h1 { margin-top: ${30 * s}px; font-size: ${84 * s}px; line-height: 1.02; font-weight: 750; letter-spacing: -0.035em; }
h1 em { display: block; font-family: Georgia, "Times New Roman", serif; font-style: italic; font-weight: 400;
  letter-spacing: -0.02em; color: #a7f3d0; font-size: ${92 * s}px; margin-top: ${4 * s}px; }
.device { position: absolute; left: 50%; top: ${top}px; transform: translateX(-50%);
  padding: ${bezel}px; border-radius: ${radius + bezel}px; background: #07090c;
  box-shadow: 0 0 0 ${2 * s}px #4b525c, 0 0 0 ${5 * s}px #1b1f24, 0 ${50 * s}px ${110 * s}px rgba(0,0,0,0.55), 0 ${10 * s}px ${30 * s}px rgba(0,0,0,0.35); }
.device img { display: block; width: ${screenW}px; height: ${screenH}px; border-radius: ${radius}px; }
.island { position: absolute; top: ${bezel + 18}px; left: 50%; transform: translateX(-50%); width: 132px; height: 38px; border-radius: 20px; background: #000; }
.cam { position: absolute; top: ${bezel / 2 - 5}px; left: 50%; transform: translateX(-50%); width: 10px; height: 10px; border-radius: 50%; background: #1f2937; box-shadow: inset 0 0 0 3px #0b0f14; }
.btn { position: absolute; width: ${5 * s}px; border-radius: 3px; background: #2a3038; }
.note { position: absolute; ${c.side === "left" ? `left: ${phone ? 56 : 90}px;` : `right: ${phone ? 56 : 90}px;`} top: ${top + Math.round(screenH * c.at)}px;
  display: flex; align-items: center; gap: ${16 * s}px; padding: ${18 * s}px ${28 * s}px ${18 * s}px ${18 * s}px; border-radius: ${26 * s}px;
  background: #fff; color: #0f172a; font-size: ${30 * s}px; font-weight: 620; letter-spacing: -0.01em;
  box-shadow: 0 ${24 * s}px ${50 * s}px rgba(0,0,0,0.35), 0 ${4 * s}px ${12 * s}px rgba(0,0,0,0.18); }
.note b { display: grid; place-items: center; width: ${56 * s}px; height: ${56 * s}px; border-radius: ${16 * s}px; }
.note b svg { width: ${30 * s}px; height: ${30 * s}px; }
.legend { gap: ${20 * s}px; padding: ${20 * s}px ${26 * s}px; font-size: ${24 * s}px; flex-wrap: wrap; max-width: ${phone ? 470 : 760}px; }
.legend span { display: inline-flex; align-items: center; gap: ${8 * s}px; }
.legend i { width: ${20 * s}px; height: ${20 * s}px; border-radius: 50%; border: ${3 * s}px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.15); }
</style></head><body>
<div class="grid"></div><div class="sweep"></div>
<header><div class="who"><i></i>${esc(c.who)}</div><h1>${esc(c.lead)}<em>${esc(c.accent)}</em></h1></header>
<div class="device">
  <img src="${pathToFileURL(path.join(RAW, shot)).href}">
  ${phone ? '<div class="island"></div>' : '<div class="cam"></div>'}
  ${phone
    ? `<div class="btn" style="left:-${7 * s}px;top:${190}px;height:70px"></div><div class="btn" style="left:-${7 * s}px;top:${290}px;height:120px"></div><div class="btn" style="right:-${7 * s}px;top:${260}px;height:150px"></div>`
    : `<div class="btn" style="top:-${7 * s}px;right:${160}px;width:110px;height:${5 * s}px"></div>`}
</div>
${note}
</body></html>`;
}

await mkdir(OUT, { recursive: true });
const tmp = await mkdtemp(path.join(os.tmpdir(), "nbss-shots-"));
const files = (await readdir(RAW)).filter((f) => /^(phone|tablet)-.*\.png$/.test(f)).sort();
try {
  for (const f of files) {
    const kind = f.startsWith("phone") ? "phone" : "tablet";
    const c = COPY[f.replace(/^(phone|tablet)-/, "").replace(/\.png$/, "")];
    if (!c) continue;
    const html = path.join(tmp, f.replace(/\.png$/, ".html"));
    await writeFile(html, page(kind, f, c));
    const [w, h] = kind === "phone" ? [1080, 1920] : [1600, 2560];
    await run(CHROME, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--allow-file-access-from-files",
      "--force-device-scale-factor=1",
      `--window-size=${w},${h}`,
      "--virtual-time-budget=4000",
      `--screenshot=${path.join(OUT, f)}`,
      pathToFileURL(html).href,
    ]);
    console.log("framed", f);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
