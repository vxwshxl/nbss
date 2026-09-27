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

export const LAYOUTS: Record<Layout, Partial<Record<DeviceName, Placement>>> = {
  laptop: { laptop: laptop(724, 214, 1100) },
  "laptop+phone": { laptop: laptop(700, 236, 950), phone: phone(1582, 338, 262) },
  trio: { laptop: laptop(690, 196, 840), phone: phone(1344, 440, 226), phone2: phone(1614, 396, 226) },
};

export function toStage(p: Placement, device: DeviceName, x: number, y: number) {
  const v = VIEWPORT[device];
  return { x: p.x + (x / v.w) * p.w, y: p.y + (y / v.h) * p.h };
}
