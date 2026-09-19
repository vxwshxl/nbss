/**
 * Builds the Expo app's icons from the same source of truth the website uses,
 * apps/web/public/logo/NBSS.png.
 *
 * The one that needs explaining is the notification icon. Android does not render a
 * notification's small icon in colour — it takes the alpha channel, throws the colours
 * away and tints whatever is left. A full-colour logo therefore arrives as a solid
 * white blob, which is what most apps ship by accident. So this flattens the mark to
 * pure white and keeps only its silhouette, which is what Android is going to do
 * anyway, done deliberately and at the right size.
 *
 *   pnpm app:icons
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "apps", "web", "public", "logo", "NBSS.png");
const OUT = path.join(ROOT, "apps", "mobile", "assets", "images");

await mkdir(OUT, { recursive: true });

// The app icon and the splash mark, straight from the source at the sizes Expo wants.
await sharp(SRC).resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "icon.png"));

await sharp(SRC).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "splash-icon.png"));

// The adaptive icon's foreground sits inside a mask, and Android crops hard: the outer
// ~25% of the canvas can be clipped on a circular launcher. Padded accordingly rather
// than resized, so the mark survives every launcher shape.
await sharp(SRC)
  .resize(660, 660, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 182, bottom: 182, left: 182, right: 182, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(path.join(OUT, "android-icon-foreground.png"));

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: "#ffffff" },
})
  .png()
  .toFile(path.join(OUT, "android-icon-background.png"));

/**
 * Monochrome (Android 13 themed icons) and the notification icon: the same treatment.
 *
 * `.threshold()` on the alpha channel turns a soft-edged logo into a clean silhouette,
 * then every visible pixel is painted white. Without the threshold, antialiased edges
 * become semi-transparent white fringes that Android renders as a smudge at 24dp.
 */
async function silhouette(size, file) {
  // The logo's own alpha channel, hardened into a stencil. Without the threshold the
  // antialiased edges stay semi-transparent and Android renders them as a grey smudge
  // at 24dp.
  const mask = await sharp(SRC)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .extractChannel("alpha")
    .threshold(40)
    .raw()
    .toBuffer();

  /**
   * A solid white image wearing that stencil as its alpha channel.
   *
   * `joinChannel` rather than a composite blend: the blend approach leaves the white
   * layer fully opaque and produces a white square, which is the exact bug this
   * function exists to avoid.
   */
  await sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
    .joinChannel(mask, { raw: { width: size, height: size, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
}

// 96px is Android's recommended small-icon size; it is downscaled to 24dp in the status
// bar and used at full size in the shade.
await silhouette(96, "notification-icon.png");
await silhouette(1024, "android-icon-monochrome.png");

console.log("wrote apps/mobile/assets/images: icon, splash-icon, android-icon-{foreground,background,monochrome}, notification-icon");
