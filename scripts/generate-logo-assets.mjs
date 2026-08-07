/**
 * Regenerates every derived logo asset from the client's source badge.
 *
 *   pnpm logo
 *
 * Source of truth is `public/logo/NBSS.png` — a 1254² transparent PNG of the
 * embroidered patch, ~2.6 MB. Nothing in the app references it directly; it is
 * far too large to ship, and every size the site actually needs is produced
 * here. Re-run this if the client sends new artwork.
 *
 * Outputs:
 *   public/logo/nbss-{96,128,256,512,1024}.webp   in-page marks and social
 *   public/logo/nbss-512.png                      fallback for WebP-hostile scrapers
 *   public/icon-{16,32,48,96,192,512}.png         tabs, Android, manifest
 *   public/apple-touch-icon.png                   iOS home screen
 *   public/favicon.ico                            16/32/48, for /favicon.ico
 *
 * `sharp` is not a declared dependency — it arrives as a transitive dependency
 * of Next's image optimiser, and this is a build-time tool run by hand rather
 * than part of `pnpm build`, so it is resolved leniently and the script exits
 * with a clear message if it is missing.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const SRC = "public/logo/NBSS.png";

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error(
    "sharp is not resolvable. It ships transitively with Next; try `pnpm install`,\n" +
      "or `pnpm add -D sharp` if this environment prunes transitive binaries.",
  );
  process.exit(1);
}

await mkdir("public/logo", { recursive: true });

// The source has a wide transparent margin around the shield. Trimming it means
// every derived size renders the badge at full bleed instead of spending pixels
// on padding — which matters most at 16px, where there are not many to spare.
const trimmed = await sharp(SRC).trim({ threshold: 1 }).toBuffer();
const { width, height } = await sharp(trimmed).metadata();

// Square it on a transparent canvas so no derived icon is distorted by a
// non-square resize, and the shield's points survive a maskable crop.
const side = Math.max(width, height);
const square = await sharp({
  create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: trimmed, gravity: "center" }])
  .png()
  .toBuffer();

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

// ------------------------------------------------------------------- marks
for (const size of [1024, 512, 256, 128, 96]) {
  await sharp(square)
    .resize(size, size, { fit: "contain", background: transparent })
    .webp({ quality: 90, effort: 6, alphaQuality: 100 })
    .toFile(`public/logo/nbss-${size}.webp`);
}
await sharp(square).resize(512, 512).png({ compressionLevel: 9 }).toFile("public/logo/nbss-512.png");

// --------------------------------------------------------------- favicons
const icoSizes = [16, 32, 48];
for (const size of [...icoSizes, 96, 192, 512]) {
  let img = sharp(square).resize(size, size, { kernel: "lanczos3" });
  // The badge is dense line work; plain bicubic downscaling turns it to mush
  // below about 48px, so the small sizes get a light sharpen to hold an edge.
  if (size <= 48) img = img.sharpen({ sigma: 0.6 });
  await img.png({ compressionLevel: 9 }).toFile(`public/icon-${size}.png`);
}

// iOS ignores alpha on the home screen and composites onto white, which would
// put a bright halo around a black patch. Flatten onto the site ink instead.
await sharp(square)
  .resize(180, 180, { fit: "contain", background: transparent })
  .flatten({ background: "#0A100D" })
  .png({ compressionLevel: 9 })
  .toFile("public/apple-touch-icon.png");

// ---------------------------------------------------------------- ico file
// Hand-assembled: the ICO container is a 6-byte header, one 16-byte directory
// entry per image, then the payloads. PNG-in-ICO is fine for every browser
// still receiving security updates, and avoids a dependency for one file.
const pngs = icoSizes.map((s) => readFileSync(`public/icon-${s}.png`));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(icoSizes.length, 4);

const dir = Buffer.alloc(16 * icoSizes.length);
let offset = header.length + dir.length;
icoSizes.forEach((size, i) => {
  const e = dir.subarray(i * 16);
  e.writeUInt8(size, 0); // width  (0 means 256)
  e.writeUInt8(size, 1); // height
  e.writeUInt8(0, 2); // palette size
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
});
await writeFile("public/favicon.ico", Buffer.concat([header, dir, ...pngs]));

console.log(`Generated logo assets from ${SRC} (trimmed ${width}×${height}, squared to ${side}).`);
