import type { DeviceName, Layout } from "./schedule";

/** CSS viewport each device was captured at. */
export const VIEWPORT: Record<DeviceName, { w: number; h: number }> = {
  laptop: { w: 1440, h: 900 },
  phone: { w: 390, h: 844 },
  phone2: { w: 390, h: 844 },
};

export const LAPTOP_CHROME = 38;
export const PHONE_STATUS = 26;

/** Where each device's screen content sits on the 1920×1080 stage. */
export type Placement = { x: number; y: number; w: number; h: number; kind: "laptop" | "phone" };

function laptop(x: number, y: number, w: number): Placement {
  return { x, y, w, h: Math.round((w * 900) / 1440), kind: "laptop" };
}
function phone(x: number, y: number, w: number): Placement {
  return { x, y, w, h: Math.round((w * 844) / 390), kind: "phone" };
}

/**
 * Nothing overlaps: the left panel ends at x = 640, and every device frame
 * (screen plus bezel, the laptop's base included) keeps clear of the others.
 * Checked by `frameBox` below — see scripts/check-layout.mjs.
 */
export const LAYOUTS: Record<Layout, Partial<Record<DeviceName, Placement>>> = {
  laptop: { laptop: laptop(724, 230, 1100) },
  "laptop+phone": { laptop: laptop(702, 262, 860), phone: phone(1642, 330, 240) },
  trio: { laptop: laptop(696, 262, 680), phone: phone(1450, 350, 196), phone2: phone(1676, 350, 196) },
};

export const LAPTOP_BEZEL = 16;
export const LAPTOP_BASE = 20;
export const LAPTOP_BASE_OVERHANG = 36;
export const PHONE_BEZEL = 11;

export function phoneStatus(p: Placement) {
  return Math.round((PHONE_STATUS * p.w) / 262);
}

/** The whole device on the stage — bezel, browser bar, status bar and base. */
export function frameBox(p: Placement) {
  if (p.kind === "laptop") {
    const top = p.y - LAPTOP_CHROME - LAPTOP_BEZEL;
    const bottom = p.y + p.h + LAPTOP_BEZEL + LAPTOP_BASE;
    return { left: p.x - LAPTOP_BEZEL - LAPTOP_BASE_OVERHANG, right: p.x + p.w + LAPTOP_BEZEL + LAPTOP_BASE_OVERHANG, top, bottom };
  }
  const top = p.y - phoneStatus(p) - PHONE_BEZEL;
  return { left: p.x - PHONE_BEZEL, right: p.x + p.w + PHONE_BEZEL, top, bottom: p.y + p.h + PHONE_BEZEL };
}

export function toStage(p: Placement, device: DeviceName, x: number, y: number) {
  const v = VIEWPORT[device];
  return { x: p.x + (x / v.w) * p.w, y: p.y + (y / v.h) * p.h };
}
