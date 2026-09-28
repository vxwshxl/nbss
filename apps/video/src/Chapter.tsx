import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { Badge, Laptop, Phone, currentStep } from "./Devices";
import { LAYOUTS, frameBox, toStage } from "./geometry";
import type { DeviceName, PlannedScene, PlannedStep } from "./schedule";
import { C, FONT, MONO, easeInOut, easeOut } from "./theme";

/** The step running at chapter frame `f` (any device). */
function activeStep(scene: PlannedScene, f: number): PlannedStep | null {
  let found: PlannedStep | null = null;
  for (const s of scene.steps) if (s.from <= f) found = s;
  return found;
}

function LeftPanel({ scene, f, total }: { scene: PlannedScene; f: number; total: number }) {
  const { fps } = useVideoConfig();
  const step = activeStep(scene, f);
  const active = step?.point ?? -1;
  const enter = (delay: number) => spring({ frame: f - delay, fps, config: { damping: 200 } });
  const progress = Math.min(1, Math.max(0, f / scene.dur));

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 640, height: 1080, padding: "70px 56px 60px 80px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: enter(0) }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 44, height: 44 }} />
        <div style={{ fontFamily: FONT, color: C.ink }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.3 }}>NBSS</div>
          <div style={{ fontSize: 13, color: C.muted }}>Product tour</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 96,
          fontFamily: MONO,
          fontSize: 17,
          letterSpacing: 3,
          color: C.mint,
          opacity: enter(4),
          transform: `translateY(${(1 - enter(4)) * 16}px)`,
        }}
      >
        CHAPTER {String(scene.number).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>
      <h1
        style={{
          margin: "18px 0 0",
          fontFamily: FONT,
          fontSize: 50,
          lineHeight: 1.08,
          fontWeight: 800,
          letterSpacing: -1.2,
          maxWidth: 500,
          color: C.ink,
          opacity: enter(8),
          transform: `translateY(${(1 - enter(8)) * 24}px)`,
        }}
      >
        {scene.heading}
      </h1>

      <ol style={{ listStyle: "none", margin: "46px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {scene.points.map((pt, i) => {
          const e = enter(14 + i * 4);
          const isActive = i === active;
          const done = active > i;
          return (
            <li
              key={pt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "14px 18px",
                borderRadius: 16,
                background: isActive ? "rgba(16,185,129,0.14)" : "transparent",
                border: `1px solid ${isActive ? "rgba(52,211,153,0.45)" : "transparent"}`,
                opacity: e * (isActive ? 1 : done ? 0.72 : 0.5),
                transform: `translateX(${(1 - e) * -24}px)`,
                transition: "none",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 34,
                  height: 34,
                  borderRadius: 99,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: MONO,
                  fontSize: 15,
                  fontWeight: 700,
                  color: isActive ? "#032018" : C.ink,
                  background: isActive ? C.bright : done ? "rgba(52,211,153,0.28)" : "rgba(255,255,255,0.08)",
                }}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                style={{
                  minWidth: 0,
                  fontFamily: FONT,
                  fontSize: 23,
                  lineHeight: "34px",
                  fontWeight: isActive ? 650 : 500,
                  color: C.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pt}
              </span>
            </li>
          );
        })}
      </ol>

      <div style={{ position: "absolute", left: 80, right: 56, bottom: 60 }}>
        <div style={{ height: 4, borderRadius: 99, background: C.faint, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: C.bright }} />
        </div>
        <div style={{ marginTop: 14, fontFamily: FONT, fontSize: 15, color: C.muted }}>Your Safety, Our Responsibility.</div>
      </div>
    </div>
  );
}

/** Where the pointer is on the stage at chapter frame `f`. */
function cursorAt(scene: PlannedScene, f: number) {
  const places = LAYOUTS[scene.layout];
  let pos = { x: 1270, y: 620 };
  let pressing: { t: number; hold: boolean; dur: number } | null = null;
  for (const s of scene.steps) {
    if (!s.action || s.action.type === "key") continue;
    const p = places[s.device];
    if (!p) continue;
    const target = toStage(p, s.device, s.action.x, s.action.y);
    if (f < s.from) break;
    const t = f - s.from;
    if (t < s.pressAt) {
      const k = easeInOut(t / s.pressAt);
      pos = { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k };
      pressing = null;
      break;
    }
    pos = target;
    const since = t - s.pressAt;
    const isHold = s.action.type === "hold";
    const holdDur = s.landAt - s.pressAt;
    if (isHold ? since < holdDur + 10 : since < 18) pressing = { t: since, hold: isHold, dur: holdDur };
    else pressing = null;
  }
  return { pos, pressing };
}

function Cursor({ scene, f }: { scene: PlannedScene; f: number }) {
  const { pos, pressing } = cursorAt(scene, f);
  const appear = easeOut((f - 14) / 12) * easeOut((scene.dur - f - 4) / 12);
  const down = pressing && (pressing.hold ? pressing.t < pressing.dur : pressing.t < 5);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: appear }}>
      {pressing && !pressing.hold && (
        <div
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
            width: 70,
            height: 70,
            marginLeft: -35,
            marginTop: -35,
            borderRadius: 99,
            border: `3px solid ${C.emerald}`,
            background: "rgba(16,185,129,0.18)",
            transform: `scale(${interpolate(pressing.t, [0, 18], [0.2, 1.15])})`,
            opacity: interpolate(pressing.t, [0, 18], [0.9, 0]),
          }}
        />
      )}
      {pressing?.hold && (
        <svg style={{ position: "absolute", left: pos.x - 44, top: pos.y - 44 }} width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r="38" stroke="rgba(244,63,94,0.25)" strokeWidth="6" fill="rgba(244,63,94,0.12)" />
          <circle
            cx="44"
            cy="44"
            r="38"
            stroke={C.rose}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 38}
            strokeDashoffset={2 * Math.PI * 38 * (1 - Math.min(1, pressing.t / pressing.dur))}
            transform="rotate(-90 44 44)"
          />
        </svg>
      )}
      <svg
        style={{
          position: "absolute",
          left: pos.x - 3,
          top: pos.y - 2,
          transform: `scale(${down ? 0.86 : 1})`,
          transformOrigin: "3px 2px",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.45))",
        }}
        width="30"
        height="34"
        viewBox="0 0 30 34"
      >
        <path d="M3 2 L3 27 L9.5 21 L14 31.5 L18.5 29.5 L14 19.5 L23 19.5 Z" fill="#fff" stroke="#0b1f18" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Chapter({ scene, total }: { scene: PlannedScene; total: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const places = LAYOUTS[scene.layout];
  const devices = Object.keys(places) as DeviceName[];
  const step = activeStep(scene, f);
  const out = easeOut((scene.dur - f) / 14);
  const fadeIn = easeOut(f / 12);

  return (
    <AbsoluteFill style={{ opacity: Math.min(out, fadeIn) }}>
      <LeftPanel scene={scene} f={f} total={total} />
      {devices.map((d, i) => {
        const p = places[d]!;
        const enter = spring({ frame: f - 6 - i * 5, fps, config: { damping: 18, stiffness: 90 } });
        const active = step?.device === d;
        return p.kind === "laptop" ? (
          <Laptop key={d} scene={scene} f={f} p={p} enter={enter} active={active} />
        ) : (
          <Phone key={d} scene={scene} device={d} f={f} p={p} enter={enter} active={active} />
        );
      })}
      {devices.map((d) => {
        const s = currentStep(scene, d, f);
        if (!s?.badge) return null;
        const t = f - s.from - s.landAt;
        if (t < 0 || t > s.dur - s.landAt) return null;
        // Under the device, never over its screen.
        const box = frameBox(places[d]!);
        const tone = s.sfx === "alarm" ? "rose" : s.sfx === "error" ? "amber" : "emerald";
        return <Badge key={d} text={s.badge} x={Math.min((box.left + box.right) / 2, 1750)} y={Math.min(box.bottom + 18, 1010)} t={t} tone={tone} />;
      })}
      <Cursor scene={scene} f={f} />
    </AbsoluteFill>
  );
}
