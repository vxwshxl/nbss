import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { PlannedScene } from "./schedule";
import { C, FONT, MONO, easeOut } from "./theme";

/** The ground every scene sits on: deep green, two slow glows and a faint grid. */
export function Background() {
  const f = useCurrentFrame();
  const a = Math.sin(f / 240) * 120;
  const b = Math.cos(f / 300) * 140;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${1300 + a}px ${260 + b / 2}px, rgba(16,185,129,0.20), transparent 70%),
                       radial-gradient(800px 600px at ${260 - b / 2}px ${900 + a / 3}px, rgba(45,212,191,0.12), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at 60% 45%, black 20%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
}

function fadeFor(f: number, dur: number) {
  return Math.min(easeOut(f / 14), easeOut((dur - f) / 16));
}

export function Intro({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: f - d, fps, config: { damping: 200 } });
  const logo = spring({ frame: f - 4, fps, config: { damping: 12, stiffness: 90 } });
  const rule = easeOut((f - 40) / 30);
  return (
    <AbsoluteFill style={{ opacity: fadeFor(f, dur) }}>
      <Img
        src={staticFile("brand/parade.jpg")}
        style={{
          position: "absolute",
          inset: 0,
          width: 1920,
          height: 1080,
          objectFit: "cover",
          opacity: 0.16,
          filter: "blur(2px) saturate(0.9)",
          transform: `scale(${1.06 + f / 3000})`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(3,23,15,0.3) 0%, rgba(3,23,15,0.95) 70%)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: FONT, color: C.ink }}>
        <div style={{ position: "relative", transform: `scale(${logo})` }}>
          <div
            style={{
              position: "absolute",
              inset: -40,
              borderRadius: 999,
              border: `2px solid ${C.mint}`,
              opacity: interpolate((f % 60) / 60, [0, 1], [0.5, 0]),
              transform: `scale(${1 + ((f % 60) / 60) * 0.4})`,
            }}
          />
          <Img src={staticFile("brand/logo.png")} style={{ width: 190, height: 190 }} />
        </div>
        <div style={{ marginTop: 40, fontSize: 110, fontWeight: 850, letterSpacing: -2, opacity: s(18), transform: `translateY(${(1 - s(18)) * 30}px)` }}>
          NBSS
        </div>
        <div style={{ marginTop: 4, fontSize: 30, color: C.muted, opacity: s(26) }}>National Bodo Security Services · Kokrajhar</div>
        <div style={{ marginTop: 26, height: 3, width: 420 * rule, background: C.bright, borderRadius: 99 }} />
        <div
          style={{
            marginTop: 26,
            fontSize: 46,
            fontWeight: 750,
            background: C.bright,
            WebkitBackgroundClip: "text",
            color: "transparent",
            opacity: s(44),
            transform: `translateY(${(1 - s(44)) * 20}px)`,
          }}
        >
          Your Safety, Our Responsibility.
        </div>
        <div style={{ marginTop: 34, display: "flex", gap: 14, opacity: s(62) }}>
          {["Website", "Operations console", "Guard & client app"].map((t) => (
            <span
              key={t}
              style={{
                padding: "10px 20px",
                borderRadius: 99,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 22,
                fontWeight: 600,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Contents({ dur, scenes }: { dur: number; scenes: PlannedScene[] }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: f - d, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ opacity: fadeFor(f, dur), fontFamily: FONT, color: C.ink, padding: "110px 130px", boxSizing: "border-box" }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 4, color: C.mint, opacity: s(0) }}>IN THIS TOUR</div>
      <div style={{ marginTop: 14, fontSize: 64, fontWeight: 800, letterSpacing: -1.5, opacity: s(4), transform: `translateY(${(1 - s(4)) * 20}px)` }}>
        From first visit to a guard on the gate
      </div>
      <div style={{ marginTop: 12, fontSize: 26, color: C.muted, opacity: s(10) }}>
        Nine chapters · every role · real screens from the website, console and app
      </div>
      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
        {scenes.map((sc, i) => {
          const e = s(18 + i * 6);
          return (
            <div
              key={sc.id}
              style={{
                display: "flex",
                gap: 20,
                alignItems: "center",
                padding: "24px 26px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                opacity: e,
                transform: `translateY(${(1 - e) * 26}px)`,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: C.gradient,
                  fontFamily: MONO,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 26, fontWeight: 700 }}>{sc.title}</span>
                <span style={{ display: "block", marginTop: 4, fontSize: 18, color: C.muted, lineHeight: 1.3 }}>{sc.points[0]}</span>
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export function Outro({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => spring({ frame: f - d, fps, config: { damping: 200 } });
  const black = interpolate(f, [dur - 40, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: easeOut(f / 14), alignItems: "center", justifyContent: "center", flexDirection: "column", fontFamily: FONT, color: C.ink }}>
        <Img src={staticFile("brand/logo.png")} style={{ width: 150, height: 150, transform: `scale(${s(0)})` }} />
        <div style={{ marginTop: 34, fontSize: 64, fontWeight: 800, letterSpacing: -1.5, opacity: s(8) }}>Your Safety, Our Responsibility.</div>
        <div style={{ marginTop: 18, fontSize: 28, color: C.muted, opacity: s(16) }}>
          Book guards online · watch every gate live · one press for help
        </div>
        <div style={{ marginTop: 48, display: "flex", gap: 18, opacity: s(26) }}>
          <span style={{ padding: "16px 30px", borderRadius: 16, background: C.gradient, fontSize: 28, fontWeight: 700 }}>
            Deployment desk · +91 70020 71628
          </span>
        </div>
        <div style={{ marginTop: 26, fontSize: 22, color: C.muted, opacity: s(34) }}>Kokrajhar · Bodoland Territorial Region · Assam</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </AbsoluteFill>
  );
}
