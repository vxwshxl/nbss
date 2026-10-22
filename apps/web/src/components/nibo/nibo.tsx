"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Nibo, the NBSS assistant's mascot: a little security robot. A navy guard's cap
 * with an emerald band and a star, an off-white helmet with a dark visor where
 * the eyes and mouth are LEDs, a radio headset with a mic boom, a chest core
 * that pulses, jointed arms and a hover thruster in place of legs.
 *
 * Pure SVG in a -60..60 × -86..74 box. Every part has its own class so the
 * motion lives in CSS (globals.css, "Nibo"): he hovers, blinks, scans, bobs his
 * arms and his thruster flickers; a mood changes the LEDs and the arms. The
 * eyes follow `--nibo-lx` / `--nibo-ly` (px, set by whoever owns the pointer).
 */
export type NiboMood = "happy" | "cheer" | "think" | "sleepy" | "wave" | "oops";
/** Open as usual; shut (a password is being typed); one eye peeking (it is shown). */
export type NiboEyes = "open" | "closed" | "peek";

const LED = "#34d399";

type NiboProps = {
  mood?: NiboMood;
  eyes?: NiboEyes;
  className?: string;
  /** No idle motion: tiny marks and anything printed. */
  still?: boolean;
  title?: string;
  /**
   * A fixed id for the SVG's gradients, for a Nibo that appears once in a fixed
   * place (the top bar's button). Without it one is generated with useId, which
   * is right for anything rendered only in the browser.
   */
  uid?: string;
};

export function Nibo(props: NiboProps) {
  return props.uid ? <NiboDrawing {...props} uid={props.uid} /> : <NiboWithId {...props} />;
}

function NiboWithId(props: NiboProps) {
  const uid = useId().replace(/:/g, "");
  return <NiboDrawing {...props} uid={uid} />;
}

function NiboDrawing({
  mood = "happy",
  eyes = "open",
  className,
  still = false,
  title,
  uid: id,
}: NiboProps & { uid: string }) {
  const shell = `nibo-shell-${id}`;
  const visor = `nibo-visor-${id}`;
  const flame = `nibo-flame-${id}`;
  const glow = `nibo-glow-${id}`;
  const clip = `nibo-clip-${id}`;
  const up = mood === "cheer";

  return (
    <svg
      viewBox="-60 -86 120 160"
      className={cn("nibo overflow-visible", still && "nibo-still", className)}
      data-mood={mood}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <radialGradient id={shell} cx="32%" cy="22%" r="90%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#e6ece9" />
          <stop offset="100%" stopColor="#b9c6c0" />
        </radialGradient>
        <linearGradient id={visor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#12302a" />
          <stop offset="100%" stopColor="#050f0c" />
        </linearGradient>
        <linearGradient id={flame} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="45%" stopColor="#34d399" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={clip}>
          <rect x="-29" y="-33" width="58" height="35" rx="14" />
        </clipPath>
      </defs>

      {/* Ground shadow: shrinks as he hovers up. */}
      <ellipse className="nibo-shadow" cx="0" cy="68" rx="24" ry="4.5" fill="rgba(4, 60, 44, 0.2)" />

      <g className="nibo-float">
        {/* Thruster */}
        <path className="nibo-flame" d="M-7,47 C-8,55 -4,64 0,68 C4,64 8,55 7,47 Z" fill={`url(#${flame})`} />
        <path d="M-9,41 h18 l-3,7 h-12 z" fill="#334155" />

        {/* Arms: shoulder joint, upper arm, hand. They swing from the shoulder. */}
        <g className={cn("nibo-arm nibo-arm-l", up && "nibo-arm-up")}>
          <rect x="-35" y="17" width="9" height="20" rx="4.5" fill={`url(#${shell})`} transform="rotate(24 -26 20)" />
          <circle cx="-36" cy="40" r="6" fill="#1e2a44" />
          <circle cx="-37.5" cy="38.5" r="2" fill="#fff" opacity="0.35" />
        </g>
        <g className={cn("nibo-arm nibo-arm-r", up && "nibo-arm-up", mood === "wave" && "nibo-arm-wave")}>
          <rect x="26" y="17" width="9" height="20" rx="4.5" fill={`url(#${shell})`} transform="rotate(-24 26 20)" />
          <circle cx="36" cy="40" r="6" fill="#1e2a44" />
          <circle cx="34.5" cy="38.5" r="2" fill="#fff" opacity="0.35" />
        </g>

        {/* Torso, with the core and a belt */}
        <rect x="-21" y="12" width="42" height="33" rx="13" fill={`url(#${shell})`} />
        <rect x="-21" y="36" width="42" height="4" fill="#1e2a44" />
        <rect x="-4" y="35.5" width="8" height="5" rx="1.2" fill="#fbbf24" />
        <circle cx="0" cy="24" r="7.5" fill="#0b1f1a" />
        <circle className="nibo-core" cx="0" cy="24" r="4.2" fill={LED} filter={`url(#${glow})`} />
        <circle cx="-13" cy="18" r="2.6" fill="#fff" opacity="0.7" />

        <g className="nibo-head">
          {/* Neck */}
          <rect x="-7" y="5" width="14" height="9" rx="3" fill="#1e2a44" />

          {/* Headset: ear pods and a mic boom */}
          <circle cx="-40" cy="-15" r="9.5" fill="#1e2a44" />
          <circle cx="-40" cy="-15" r="5" fill="none" stroke={LED} strokeWidth="2" className="nibo-pod" />
          <circle cx="40" cy="-15" r="9.5" fill="#1e2a44" />
          <circle cx="40" cy="-15" r="5" fill="none" stroke={LED} strokeWidth="2" className="nibo-pod" />
          <path d="M-42,-6 C-42,6 -32,10 -20,8" stroke="#1e2a44" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="-19" cy="8" r="3" fill="#1e2a44" />
          <circle cx="-19" cy="8" r="1.4" fill={LED} />

          {/* Helmet */}
          <rect x="-37" y="-44" width="74" height="54" rx="22" fill={`url(#${shell})`} />
          <ellipse cx="-22" cy="-30" rx="9" ry="4.5" fill="#fff" opacity="0.8" transform="rotate(-28 -22 -30)" />

          {/* Visor */}
          <rect x="-29" y="-33" width="58" height="35" rx="14" fill={`url(#${visor})`} />
          <g clipPath={`url(#${clip})`}>
            <rect className="nibo-scan" x="-29" y="-33" width="58" height="5" fill={LED} opacity="0.12" />
            <path d="M-24,-26 Q-14,-31 -2,-30" stroke="#fff" strokeWidth="2" opacity="0.18" fill="none" strokeLinecap="round" />
          </g>
          <rect x="-25" y="-11" width="7" height="3.5" rx="1.75" fill="#fb7185" opacity="0.4" />
          <rect x="18" y="-11" width="7" height="3.5" rx="1.75" fill="#fb7185" opacity="0.4" />
          <Face mood={mood} eyes={eyes} glow={glow} />

          {/* Cap: crown, band, star, brim */}
          <g className="nibo-cap">
            <path d="M-35,-38 C-35,-60 -19,-68 0,-68 C19,-68 35,-60 35,-38 Z" fill="#1e2a44" />
            <path d="M-22,-62 C-12,-66 -2,-66 6,-65" stroke="#fff" strokeWidth="2" opacity="0.18" fill="none" strokeLinecap="round" />
            <rect x="-35" y="-45" width="70" height="7" fill="#10b981" />
            <path
              className="nibo-star"
              d="M0,-60 l2.4,4.9 5.4,0.8 -3.9,3.8 0.9,5.4 -4.8,-2.6 -4.8,2.6 0.9,-5.4 -3.9,-3.8 5.4,-0.8 z"
              fill="#fbbf24"
            />
            <path d="M-39,-38 Q0,-31 39,-38 L41,-34 Q0,-25 -41,-34 Z" fill="#0f172a" />
          </g>
        </g>

        {mood === "think" && (
          <g className="nibo-dots" fill="#10b981">
            <circle cx="42" cy="-50" r="3" />
            <circle cx="50" cy="-59" r="3.8" />
            <circle cx="58" cy="-69" r="4.8" />
          </g>
        )}
        {mood === "sleepy" && (
          <g className="nibo-zzz" fill="#047857" fontFamily="ui-sans-serif, system-ui" fontWeight="900">
            <text x="36" y="-52" fontSize="13">z</text>
            <text x="46" y="-63" fontSize="10">z</text>
          </g>
        )}
        {mood === "cheer" && (
          <g className="nibo-sparkles" fill="#fbbf24">
            <path d="M-52,-48 l3,-8 3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 z" />
            <path d="M50,-38 l2,-6 2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 z" />
          </g>
        )}
      </g>
    </svg>
  );
}

function Face({ mood, eyes, glow }: { mood: NiboMood; eyes: NiboEyes; glow: string }) {
  const f = `url(#${glow})`;
  const line = { stroke: LED, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none", filter: f };

  // A password is being typed: eyes shut, or one peeking while it is shown.
  if (eyes !== "open" || mood === "sleepy") {
    return (
      <g>
        <path d="M-17,-16 h9" {...line} />
        {eyes === "peek" ? (
          <rect x="8.5" y="-22" width="7" height="11" rx="3.5" fill={LED} filter={f} />
        ) : (
          <path d="M8,-16 h9" {...line} />
        )}
        <path d="M-4,-5 h8" {...line} strokeWidth={2.2} />
      </g>
    );
  }

  if (mood === "cheer") {
    return (
      <g>
        <path d="M-18,-13 l5.5,-6 5.5,6" {...line} />
        <path d="M7,-13 l5.5,-6 5.5,6" {...line} />
        <path d="M-7,-6 Q0,1 7,-6" {...line} strokeWidth={2.4} />
      </g>
    );
  }

  if (mood === "oops") {
    return (
      <g>
        <path d="M-17,-21 l7,5 -7,5" {...line} />
        <path d="M17,-21 l-7,5 7,5" {...line} />
        <path d="M-5,-4 q2.5,-3 5,0 t5,0" {...line} strokeWidth={2.2} />
        <path d="M24,-30 q-3.5,5 0,7 q3.5,-2 0,-7 z" fill="#7dd3fc" />
      </g>
    );
  }

  return (
    <g>
      <g className="nibo-eyes">
        <g className="nibo-pupils">
          <rect x="-16" y="-23" width="8" height="13" rx="4" fill={LED} filter={f} />
          <rect x="8" y="-23" width="8" height="13" rx="4" fill={LED} filter={f} />
          <rect x="-14" y="-21" width="2.4" height="3.4" rx="1.2" fill="#ecfdf5" />
          <rect x="10" y="-21" width="2.4" height="3.4" rx="1.2" fill="#ecfdf5" />
        </g>
      </g>
      {mood === "think" ? (
        <path d="M-5,-4 h8" {...line} strokeWidth={2.2} />
      ) : (
        <path d="M-6,-6 Q0,-1 6,-6" {...line} strokeWidth={2.2} />
      )}
    </g>
  );
}
