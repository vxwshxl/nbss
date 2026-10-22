import { cn } from "@/lib/utils";

/**
 * A site gate at night, live: the picture on the sign-in screen.
 *
 * Everything moves in CSS (globals.css, "Gate scene") so it runs off the main
 * thread and one reduced-motion rule stills it: a car pulls up, the boom lifts
 * and it drives through, the booth's beacon turns, a guard sweeps a torch, a
 * second walks the wall, the camera pans and the town's windows come and go.
 * Two lanes, each with its boom: a car comes in on the far lane and another
 * leaves on the near one half a cycle later. Each car shares a 12 s cycle
 * with its boom and wheels so they stay in step.
 *
 * Decorative throughout, so the whole drawing is aria-hidden.
 */
const WINDOWS: [number, number, number][] = [
  // x, y, delay (s)
  [34, 128, 0], [58, 128, 2.1], [34, 152, 4.4], [58, 176, 1.2],
  [118, 104, 3.3], [142, 104, 0.7], [118, 128, 5.1], [142, 152, 2.6], [118, 176, 3.9],
  [214, 140, 1.8], [238, 164, 4.8], [214, 188, 0.4],
  [300, 96, 2.9], [324, 120, 0.9], [300, 144, 4.1], [324, 168, 1.5], [300, 192, 3.6],
  [700, 112, 1.1], [724, 136, 3.7], [748, 112, 5.4], [700, 160, 2.2], [748, 184, 0.3],
];

const STARS: [number, number, number][] = [
  [40, 24, 0], [110, 52, 1.4], [180, 18, 2.8], [260, 44, 0.6], [340, 22, 2.1], [410, 58, 3.3],
  [470, 16, 1.1], [540, 40, 2.5], [600, 70, 0.2], [660, 30, 3.8], [760, 54, 1.7], [790, 18, 2.9],
];

function Guard({ className, torch = false }: { className?: string; torch?: boolean }) {
  return (
    <g className={className}>
      {torch && (
        <path className="gs-torch" d="M-6,-30 L-120,-6 L-118,22 Z" fill="url(#gs-beam)" />
      )}
      {/* legs */}
      <rect className="gs-leg gs-leg-a" x="-5" y="-14" width="5" height="16" rx="2" fill="#1e2a44" />
      <rect className="gs-leg gs-leg-b" x="1" y="-14" width="5" height="16" rx="2" fill="#26355a" />
      {/* boots */}
      <rect x="-6" y="0" width="7" height="3" rx="1" fill="#0b0f19" />
      <rect x="0" y="0" width="7" height="3" rx="1" fill="#0b0f19" />
      {/* shirt */}
      <path d="M-8,-36 h16 l2,24 h-20 z" fill="#9fb8d6" />
      <rect x="-8" y="-16" width="16" height="3" fill="#1e2a44" />
      {/* arm with torch */}
      <rect x="-12" y="-34" width="5" height="14" rx="2" fill="#8aa6c8" transform="rotate(35 -10 -34)" />
      {torch && <circle cx="-8" cy="-30" r="2.4" fill="#fde68a" />}
      {/* head + cap */}
      <circle cx="0" cy="-42" r="6" fill="#c68a5a" />
      <path d="M-7,-45 q7,-8 14,0 z" fill="#0f172a" />
      <rect x="-9" y="-46" width="12" height="2" rx="1" fill="#0f172a" />
    </g>
  );
}

function Car({ body, roof, wheelClass = "gs-wheel" }: { body: string; roof: string; wheelClass?: string }) {
  return (
    <>
      <path d="M0,0 h104 a6,6 0 0 1 6,6 v14 h-116 v-14 a6,6 0 0 1 6,-6 z" transform="translate(0 236)" fill={body} />
      <path d="M20,236 l12,-16 h44 l14,16 z" fill={roof} />
      <path d="M34,234 l9,-11 h14 v11 z M61,234 v-11 h14 l9,11 z" fill="#99f6e4" opacity="0.7" />
      <rect x="104" y="241" width="6" height="5" rx="1" fill="#fef3c7" />
      <path className="gs-headlight" d="M110,243 L190,232 L190,258 Z" fill="#fef3c7" opacity="0.18" />
      <rect x="-6" y="241" width="4" height="5" rx="1" fill="#ef4444" />
      {[22, 84].map((cx) => (
        <g key={cx} className={wheelClass} style={{ transformOrigin: `${cx}px 256px` }}>
          <circle cx={cx} cy="256" r="9" fill="#0b0f19" />
          <circle cx={cx} cy="256" r="3.5" fill="#64748b" />
          <rect x={cx - 1} y="248" width="2" height="16" fill="#334155" />
        </g>
      ))}
    </>
  );
}

export function GateScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={cn("gate-scene block w-full", className)}
    >
      <defs>
        <linearGradient id="gs-beam" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gs-search" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gs-moon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="70%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </radialGradient>
        <radialGradient id="gs-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0" />
        </radialGradient>
        <pattern id="gs-stripe" width="16" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#f59e0b" />
          <rect x="8" width="8" height="8" fill="#f8fafc" />
        </pattern>
      </defs>

      {/* Sky */}
      <circle cx="640" cy="60" r="60" fill="url(#gs-glow)" />
      <circle cx="640" cy="60" r="20" fill="url(#gs-moon)" />
      <circle cx="633" cy="55" r="3.5" fill="#cbd5e1" />
      <circle cx="646" cy="66" r="2.5" fill="#cbd5e1" />
      {STARS.map(([x, y, d]) => (
        <circle key={`${x}-${y}`} className="gs-star" cx={x} cy={y} r="1.4" fill="#e2e8f0" style={{ animationDelay: `${d}s` }} />
      ))}

      {/* Searchlight from the booth roof */}
      <g className="gs-search">
        <path d="M640,132 L560,-20 L700,-20 Z" fill="url(#gs-search)" />
      </g>

      {/* The town behind the wall */}
      <g fill="#14231d">
        <rect x="20" y="114" width="56" height="116" />
        <rect x="104" y="90" width="60" height="140" />
        <rect x="200" y="126" width="56" height="104" />
        <rect x="286" y="82" width="60" height="148" />
        <rect x="380" y="150" width="70" height="80" />
        <rect x="686" y="98" width="80" height="132" />
      </g>
      {WINDOWS.map(([x, y, d]) => (
        <rect key={`${x}-${y}`} className="gs-win" x={x} y={y} width="12" height="10" rx="1.5" fill="#fbbf24" style={{ animationDelay: `${d}s` }} />
      ))}

      {/* Perimeter wall with its railing */}
      <rect x="0" y="206" width="430" height="26" fill="#1b2e26" />
      <rect x="0" y="204" width="430" height="4" fill="#2a4438" />
      <g stroke="#2a4438" strokeWidth="2">
        {Array.from({ length: 27 }, (_, i) => (
          <line key={i} x1={8 + i * 16} y1="204" x2={8 + i * 16} y2="190" />
        ))}
        <line x1="0" y1="192" x2="430" y2="192" />
      </g>

      {/* A guard walking the wall */}
      <g className="gs-patrol">
        <Guard className="gs-walker" />
      </g>

      {/* CCTV on its pole */}
      <rect x="452" y="120" width="4" height="110" fill="#334155" />
      <g className="gs-cam">
        <rect x="438" y="112" width="26" height="12" rx="3" fill="#cbd5e1" />
        <rect x="434" y="114" width="6" height="8" rx="1.5" fill="#475569" />
        <circle className="gs-rec" cx="460" cy="118" r="1.8" fill="#ef4444" />
      </g>

      {/* The guard booth */}
      <g>
        <rect x="600" y="150" width="90" height="82" rx="3" fill="#e7efe9" />
        <rect x="594" y="140" width="102" height="12" rx="2" fill="#047857" />
        <text x="645" y="149.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ecfdf5" letterSpacing="2" style={{ fontFamily: "var(--font-sans)" }}>
          NBSS
        </text>
        <rect className="gs-booth-win" x="612" y="164" width="46" height="30" rx="2" fill="#fde68a" />
        <line x1="635" y1="164" x2="635" y2="194" stroke="#d6b65a" strokeWidth="1.5" />
        <rect x="666" y="168" width="16" height="64" rx="1.5" fill="#94a3b8" />
        <circle cx="670" cy="200" r="1.4" fill="#334155" />
        <rect x="640" y="128" width="10" height="12" rx="2" fill="#475569" />
        <circle className="gs-beacon" cx="645" cy="126" r="5" fill="#34d399" />
      </g>

      {/* The guard at the post, sweeping a torch */}
      <g transform="translate(570 232)">
        <Guard className="gs-post" torch />
      </g>

      {/* Road: two lanes, in on the far one and out on the near one */}
      <rect x="0" y="232" width="800" height="68" fill="#0d1512" />
      <rect x="0" y="232" width="800" height="3" fill="#24372f" />
      <g className="gs-lane">
        {Array.from({ length: 22 }, (_, i) => (
          <rect key={i} x={i * 48} y="267" width="26" height="2.5" rx="1.25" fill="#4b6b5d" />
        ))}
      </g>
      <rect x="0" y="297" width="800" height="3" fill="#24372f" />

      {/* Entry boom, across the far lane: post on the kerb, arm at bonnet height. */}
      <rect x="582" y="226" width="18" height="10" rx="2" fill="#334155" />
      <rect x="586" y="214" width="10" height="24" rx="2" fill="#475569" />
      <g className="gs-boom">
        <rect x="414" y="236" width="180" height="7" rx="3.5" fill="url(#gs-stripe)" />
        <circle cx="414" cy="239.5" r="3" fill="#ef4444" />
        <rect x="414" y="243" width="3" height="16" rx="1" fill="#94a3b8" />
      </g>
      <circle cx="591" cy="239" r="5" fill="#1e293b" />

      {/* A car coming in on the far lane */}
      <g className="gs-car">
        <Car body="#0f766e" roof="#115e59" />
      </g>

      {/* Exit boom, across the near lane, opening the other way */}
      <g className="gs-boom2">
        <rect x="470" y="268" width="134" height="7" rx="3.5" fill="url(#gs-stripe)" />
        <circle cx="604" cy="271.5" r="3" fill="#ef4444" />
        <rect x="601" y="275" width="3" height="16" rx="1" fill="#94a3b8" />
      </g>
      <rect x="460" y="262" width="10" height="34" rx="2" fill="#475569" />
      <rect x="456" y="292" width="18" height="8" rx="2" fill="#334155" />
      <circle cx="465" cy="271" r="5" fill="#1e293b" />

      {/* A car leaving on the near lane, facing left */}
      <g className="gs-car2">
        <g transform="translate(110 32) scale(-1 1)">
          <Car body="#1e3a8a" roof="#1e40af" wheelClass="gs-wheel2" />
        </g>
      </g>
    </svg>
  );
}
