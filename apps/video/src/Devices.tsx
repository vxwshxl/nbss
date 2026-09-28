import { Img, interpolate, spring, staticFile, useVideoConfig } from "remotion";

import {
  LAPTOP_BASE_OVERHANG,
  LAPTOP_BEZEL,
  LAPTOP_CHROME,
  PHONE_BEZEL,
  VIEWPORT,
  phoneStatus,
  type Placement,
} from "./geometry";
import type { DeviceName, PlannedScene, PlannedStep } from "./schedule";
import { C, FONT, easeInOut, easeOut } from "./theme";

const FADE = 6;

type Shown = { src: string; seq: boolean; step: PlannedStep | null };

/** What a device's screen shows at chapter frame `f`. */
function shownAt(scene: PlannedScene, device: DeviceName, f: number): Shown {
  const mine = scene.steps.filter((s) => s.device === device);
  if (mine.length === 0) return { src: "", seq: false, step: null };
  let idx = -1;
  for (let i = 0; i < mine.length; i++) if (mine[i]!.from <= f) idx = i;
  if (idx === -1) return { src: mine[0]!.before ?? mine[0]!.image, seq: false, step: null };

  const s = mine[idx]!;
  const prev = idx > 0 ? mine[idx - 1]!.image : (s.before ?? s.image);
  const t = f - s.from;
  if (!s.action) return { src: t < 1 ? prev : s.image, seq: false, step: s };
  if (t < s.pressAt) return { src: s.before ?? prev, seq: false, step: s };
  if (t < s.landAt) {
    const frames = s.frames ?? [];
    const per = s.action.type === "hold" ? 6 : 3;
    const k = Math.floor((t - s.pressAt - 4) / per);
    if (frames.length && k >= 0) return { src: frames[Math.min(k, frames.length - 1)]!, seq: true, step: s };
    if (frames.length && s.action.type === "hold") return { src: frames[0]!, seq: true, step: s };
    return { src: s.before ?? prev, seq: false, step: s };
  }
  return { src: s.image, seq: false, step: s };
}

/** The current step of a device, and the frame within it. */
export function currentStep(scene: PlannedScene, device: DeviceName, f: number) {
  return shownAt(scene, device, f).step;
}

function Screen({ scene, device, f, p }: { scene: PlannedScene; device: DeviceName; f: number; p: Placement }) {
  const now = shownAt(scene, device, f);
  // A cross-fade whenever the picture changes, except while typing or holding —
  // there each snapshot replaces the last, as the real screen did.
  let prev: string | null = null;
  let fade = 1;
  if (!now.seq) {
    for (let k = 1; k <= FADE; k++) {
      const back = shownAt(scene, device, f - k);
      if (back.src !== now.src) {
        prev = back.src;
        fade = k / FADE;
        break;
      }
    }
  }

  const v = VIEWPORT[device];
  const scale = p.w / v.w;
  const s = now.step;

  // Zoom: in after the screen lands, out before the step ends.
  let zoom = 1;
  let origin = "50% 50%";
  if (s?.zoom) {
    const t = f - s.from;
    const zin = easeInOut((t - s.landAt - 6) / 20);
    const zout = easeInOut((s.dur - t) / 16);
    zoom = 1 + (s.zoom.scale - 1) * Math.min(zin, zout);
    origin = `${s.zoom.x * scale}px ${s.zoom.y * scale}px`;
  }

  // A page scroll: pan down the full-length capture, pause, come back up.
  let pan: { src: string; y: number; h: number } | null = null;
  if (s?.scroll) {
    const t = f - s.from - s.landAt;
    const down = s.pan;
    if (t >= 0 && t < down + 14 + 26) {
      const prog = t < down ? easeInOut(t / down) : t < down + 14 ? 1 : 1 - easeInOut((t - down - 14) / 26);
      pan = { src: s.scroll.image, y: -s.scroll.to * prog * scale, h: s.scroll.pageHeight * scale };
    }
  }

  const img = (src: string, opacity = 1) => (
    <Img
      src={staticFile(src)}
      style={{ position: "absolute", inset: 0, width: p.w, height: p.h, objectFit: "cover", objectPosition: "top", opacity }}
    />
  );

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#fff" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: origin }}>
        {pan ? (
          <Img
            src={staticFile(pan.src)}
            style={{ position: "absolute", left: 0, top: pan.y, width: p.w, height: pan.h }}
          />
        ) : (
          <>
            {prev && fade < 1 ? img(prev) : null}
            {now.src ? img(now.src, prev ? easeOut(fade) : 1) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Whose screen this is — role above, name below — sized to its device so two
 * labels can never run into each other.
 */
function PovPill({
  text,
  x,
  y,
  width,
  align,
  active,
}: {
  text: string;
  x: number;
  y: number;
  width: number;
  align: "left" | "center";
  active: boolean;
}) {
  const [role, ...rest] = text.split(" · ");
  const name = rest.join(" · ");
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: width,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "6px 12px 6px 10px",
          borderRadius: 12,
          background: active ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${active ? "rgba(52,211,153,0.55)" : "rgba(255,255,255,0.14)"}`,
          color: C.ink,
          fontFamily: FONT,
          overflow: "hidden",
        }}
      >
        <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 99, background: active ? C.mint : "rgba(255,255,255,0.4)" }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.muted, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {role}
          </span>
          {name && (
            <span style={{ display: "block", fontSize: 15, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {name}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function Laptop({
  scene,
  f,
  p,
  enter,
  active,
}: {
  scene: PlannedScene;
  f: number;
  p: Placement;
  enter: number;
  active: boolean;
}) {
  const now = shownAt(scene, "laptop", f).step ?? scene.steps.find((s) => s.device === "laptop") ?? null;
  const bezel = LAPTOP_BEZEL;
  const top = p.y - LAPTOP_CHROME - bezel;
  const w = p.w + bezel * 2;
  const h = p.h + LAPTOP_CHROME + bezel * 2;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: enter, transform: `translateY(${(1 - enter) * 40}px)` }}>
      {now && <PovPill text={now.pov} x={p.x - bezel} y={top - 58} width={w} align="left" active={active} />}
      <div
        style={{
          position: "absolute",
          left: p.x - bezel,
          top,
          width: w,
          height: h,
          borderRadius: 22,
          background: "linear-gradient(180deg, #1d2724 0%, #0e1412 100%)",
          boxShadow: active
            ? "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(16,185,129,0.22)"
            : "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      />
      {/* Browser chrome */}
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y - LAPTOP_CHROME,
          width: p.w,
          height: LAPTOP_CHROME,
          background: "#eef1f0",
          borderRadius: "8px 8px 0 0",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px",
          boxSizing: "border-box",
          borderBottom: "1px solid #d9dedc",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 99, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 14,
            flex: 1,
            maxWidth: p.w * 0.6,
            height: 24,
            borderRadius: 8,
            background: "#fff",
            border: "1px solid #dfe4e2",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            fontFamily: FONT,
            fontSize: 13,
            color: "#3c4a45",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <svg width="11" height="12" viewBox="0 0 11 12">
            <rect x="1" y="5" width="9" height="7" rx="1.5" fill="#6b7a74" />
            <path d="M3 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="#6b7a74" strokeWidth="1.4" fill="none" />
          </svg>
          {now?.url ?? ""}
        </div>
      </div>
      <div style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, overflow: "hidden" }}>
        <Screen scene={scene} device="laptop" f={f} p={p} />
      </div>
      {/* Base */}
      <div
        style={{
          position: "absolute",
          left: p.x - bezel - LAPTOP_BASE_OVERHANG,
          top: top + h,
          width: w + LAPTOP_BASE_OVERHANG * 2,
          height: 20,
          borderRadius: "0 0 18px 18px",
          background: "linear-gradient(180deg, #2a3431 0%, #121816 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: p.x + p.w / 2 - 80,
          top: top + h,
          width: 160,
          height: 8,
          borderRadius: "0 0 10px 10px",
          background: "#0b100e",
        }}
      />
    </div>
  );
}

export function Phone({
  scene,
  device,
  f,
  p,
  enter,
  active,
}: {
  scene: PlannedScene;
  device: DeviceName;
  f: number;
  p: Placement;
  enter: number;
  active: boolean;
}) {
  const now = shownAt(scene, device, f).step ?? scene.steps.find((s) => s.device === device) ?? null;
  const bezel = PHONE_BEZEL;
  const status = phoneStatus(p);
  const left = p.x - bezel;
  const top = p.y - status - bezel;
  const w = p.w + bezel * 2;
  const h = p.h + status + bezel * 2;
  const radius = Math.round(p.w * 0.16);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>
      {now && <PovPill text={now.pov} x={left} y={top - 58} width={w} align="center" active={active} />}
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: w,
          height: h,
          borderRadius: radius + bezel,
          background: "linear-gradient(160deg, #2b3532 0%, #0c1110 60%)",
          boxShadow: active
            ? "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.12), 0 0 50px rgba(16,185,129,0.28)"
            : "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1.5px rgba(255,255,255,0.12)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: p.x,
          top: p.y - status,
          width: p.w,
          height: p.h + status,
          borderRadius: radius,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            height: status,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${p.w * 0.09}px`,
            fontFamily: FONT,
            fontSize: status * 0.5,
            fontWeight: 600,
            color: "#111",
            background: "#f5f7f6",
          }}
        >
          <span>2:14</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <svg width={status * 0.6} height={status * 0.4} viewBox="0 0 18 12">
              {[3, 6, 9, 12].map((hh, i) => (
                <rect key={i} x={i * 4.5} y={12 - hh} width="3" height={hh} rx="1" fill="#111" />
              ))}
            </svg>
            <svg width={status * 0.9} height={status * 0.45} viewBox="0 0 26 12">
              <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#111" fill="none" />
              <rect x="2" y="2" width="16" height="8" rx="1.5" fill="#111" />
              <rect x="23.5" y="4" width="2" height="4" rx="1" fill="#111" />
            </svg>
          </span>
        </div>
        <div style={{ position: "absolute", left: 0, top: status, width: p.w, height: p.h, overflow: "hidden" }}>
          <Screen scene={scene} device={device} f={f} p={p} />
        </div>
      </div>
      {/* Dynamic island */}
      <div
        style={{
          position: "absolute",
          left: p.x + p.w / 2 - p.w * 0.14,
          top: p.y - status + status * 0.18,
          width: p.w * 0.28,
          height: status * 0.64,
          borderRadius: 99,
          background: "#050807",
        }}
      />
    </div>
  );
}

/** A callout that pops up beside a device: "Live — no refresh", "Alert received". */
export function Badge({
  text,
  x,
  y,
  t,
  tone,
}: {
  text: string;
  x: number;
  y: number;
  t: number;
  tone: "emerald" | "rose" | "amber";
}) {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: t, fps, config: { damping: 14, stiffness: 180 } });
  const color = tone === "rose" ? C.rose : tone === "amber" ? C.amber : C.emerald;
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t / 7));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, 0) scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
        transformOrigin: "center top",
        opacity: pop,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 20px 12px 16px",
        borderRadius: 16,
        background: "#ffffff",
        color: "#0b1f18",
        fontFamily: FONT,
        fontSize: 20,
        fontWeight: 700,
        boxShadow: `0 18px 40px rgba(0,0,0,0.35), 0 0 0 3px ${color}55`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 99,
          background: color,
          boxShadow: `0 0 0 ${6 * pulse}px ${color}33`,
        }}
      />
      {text}
    </div>
  );
}

