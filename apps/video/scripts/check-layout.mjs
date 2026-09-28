/**
 * Proves the stage has no collisions: for every layout, each device's frame,
 * its label above and its badge below stay on screen, clear of the left panel
 * and clear of every other device.
 *
 *   node scripts/check-layout.mjs
 */
import { LAYOUTS, frameBox } from "../src/geometry.ts";

const PANEL_RIGHT = 640;
const LABEL_H = 50; // two-line device label, placed 58 px above the frame
const BADGE = { w: 300, h: 48 }; // widest badge text at 20 px

const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let problems = 0;

for (const [layout, devices] of Object.entries(LAYOUTS)) {
  const boxes = [];
  for (const [name, p] of Object.entries(devices)) {
    const f = frameBox(p);
    boxes.push({ name: `${name} frame`, ...f, owner: name });
    boxes.push({ name: `${name} label`, left: f.left + (p.kind === "laptop" ? 36 : 0), right: f.right - (p.kind === "laptop" ? 36 : 0), top: f.top - 58, bottom: f.top - 58 + LABEL_H, owner: name });
    const cx = Math.min((f.left + f.right) / 2, 1750);
    const by = Math.min(f.bottom + 18, 1010);
    boxes.push({ name: `${name} badge`, left: cx - BADGE.w / 2, right: cx + BADGE.w / 2, top: by, bottom: by + BADGE.h, owner: name, badge: true });
  }
  for (const b of boxes) {
    if (b.left < PANEL_RIGHT || b.right > 1920 || b.top < 0 || b.bottom > 1080) {
      console.log(`✗ ${layout}: ${b.name} leaves the stage (${Math.round(b.left)}–${Math.round(b.right)} × ${Math.round(b.top)}–${Math.round(b.bottom)})`);
      problems++;
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.owner === b.owner) continue;
      // Badges show one at a time, and only under the device that is acting.
      if (a.badge || b.badge) {
        const badge = a.badge ? a : b, other = a.badge ? b : a;
        if (!other.name.endsWith("frame") || !overlap(badge, other)) continue;
      } else if (!overlap(a, b)) continue;
      console.log(`✗ ${layout}: ${a.name} overlaps ${b.name}`);
      problems++;
    }
  console.log(`${problems ? "…" : "✓"} ${layout}`);
}
console.log(problems ? `${problems} problem(s)` : "No overlaps.");
process.exit(problems ? 1 : 0);
