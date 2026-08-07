import Image from "next/image";
import type { ReactElement } from "react";

/**
 * One inline sprite rendered by name. Every glyph is drawn on a 24×24 grid with
 * stroke geometry only, so the single `.ico` rule in globals.css controls
 * weight, join and colour — and `currentColor` lets a card or division re-point
 * its icon through `--accent`.
 */

const paths: Record<string, ReactElement> = {
  shield: <><path d="M12 2.5 4 5.5v7c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-7l-8-3Z" /><path d="m8.8 12 2.2 2.3 4.2-4.6" /></>,
  "shield-check": <><path d="M12 2.5 4 5.5v7c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-7l-8-3Z" /><path d="m8.8 12 2.2 2.3 4.2-4.6" /></>,
  "shield-alt": <><path d="M12 2.5 4 5.5v7c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-7l-8-3Z" /><path d="M12 8v8" /><path d="M9 11h6" /></>,
  building: <><path d="M4 21V6l7-3v18" /><path d="M11 9h9v12" /><path d="M7 9v0M7 13v0M7 17v0M15 13v0M15 17v0" /><path d="M2 21h20" /></>,
  factory: <><path d="M2 21V10l6 4V10l6 4V6l6 3v12Z" /><path d="M7 17v0M12 17v0M17 17v0" /></>,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M10 10v8M14 10v8M19 10v8" /><path d="M2.5 21h19" /></>,
  truck: <><path d="M2 7h11v9H2Z" /><path d="M13 10h4l3 3v3h-7Z" /><circle cx="6" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  cart: <><path d="M3 4h2.2l2.3 11h9.6l2-7H6.5" /><circle cx="9" cy="19" r="1.6" /><circle cx="17" cy="19" r="1.6" /></>,
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />,
  book: <><path d="M4 4.5A2 2 0 0 1 6 3h13v15H6a2 2 0 0 0-2 2Z" /><path d="M19 18v3H6a2 2 0 0 1 0-4h13" /></>,
  home: <><path d="m3 11 9-7 9 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-6h4v6" /></>,
  bell: <><path d="M18 16V11a6 6 0 1 0-12 0v5l-2 3h16Z" /><path d="M10 22h4" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  helmet: <><path d="M3 15a9 9 0 0 1 18 0" /><path d="M2 15h20v3H2Z" /><path d="M9 7V4h6v3" /></>,
  flag: <><path d="M5 21V3" /><path d="M5 4h13l-3 4 3 4H5" /></>,
  person: <><circle cx="12" cy="7" r="3.5" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  "user-shield": <><circle cx="9" cy="7" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 11-4.7" /><path d="M18 11.5 14 13v3.2c0 2.2 1.6 3.9 4 4.3 2.4-.4 4-2.1 4-4.3V13Z" /></>,
  leaf: <><path d="M4 20C4 10 10 4 20 4c0 10-6 16-16 16Z" /><path d="M9 15c2-3 5-5 8-6" /></>,
  landmark: <><path d="M3 9 12 4l9 5" /><path d="M6 9v9M10.5 9v9M13.5 9v9M18 9v9" /><path d="M2.5 21h19M4 18h16" /></>,
  paw: <><circle cx="7" cy="8" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="17" cy="8" r="2" /><path d="M12 11c-3 0-5 2.4-5 5a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3c0-2.6-2-5-5-5Z" /></>,
  broom: <><path d="M14 3 8 9" /><path d="m6 11 5-5 4 4-5 5Z" /><path d="M10 15 5 21h12l-3-6" /></>,
  recycle: <><path d="M8 4.5 5 10h6Z" /><path d="M16 4.5 19 10h-6Z" /><path d="M4 14.5 7 20h10l3-5.5" /><path d="M9 20 7 17l-3 1" /></>,
  bug: <><circle cx="12" cy="13" r="5" /><path d="M9 8a3 3 0 0 1 6 0" /><path d="M4 11h3M17 11h3M4 17h3M17 17h3M12 18v3" /></>,
  plant: <><path d="M12 21v-8" /><path d="M12 13C7 13 5 10 5 6c4 0 7 2 7 7Z" /><path d="M12 15c5 0 7-3 7-7-4 0-7 2-7 7Z" /></>,
  droplet: <path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3Z" />,
  people: <><circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9" r="2.4" /><path d="M17.5 14a5 5 0 0 1 4.5 4" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><path d="M4 13h3v6H5a1 1 0 0 1-1-1Z" /><path d="M20 13h-3v6h2a1 1 0 0 0 1-1Z" /><path d="M17 19v1a2 2 0 0 1-2 2h-3" /></>,
  wheel: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3v5.8M4.4 16.5l5-2.9M19.6 16.5l-5-2.9" /></>,
  wrench: <path d="M15.5 3a5.5 5.5 0 0 0-5 7.6L3 18v3h3l7.4-7.5A5.5 5.5 0 1 0 15.5 3Z" />,
  camera: <><path d="M3 8h11l3 2.5V17H3Z" /><circle cx="8.5" cy="12.5" r="2.4" /><path d="m17 11 4-2v7l-4-2" /></>,
  key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9" /><path d="M17 12v4M20 12v3" /></>,
  fire: <path d="M12 3c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.5-.8-2.4-.8-2.4S17 12 17 15a5 5 0 0 1-10 0C7 9 12 8 12 3Z" />,
  radio: <><circle cx="12" cy="12" r="2.5" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" /><path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  rupee: <path d="M7 4h10M7 9h10M17 4c0 3.5-2.5 5-6 5h-1l7 11" />,
  roots: <><path d="M12 3v9" /><path d="M12 12c-4 0-6 2-6 5M12 12c4 0 6 2 6 5" /><path d="M4 21h4M16 21h4M10 21h4" /></>,
  drill: <><path d="M12 3v4" /><circle cx="12" cy="12" r="4.5" /><path d="M12 16.5V21M4.5 12H2M22 12h-2.5" /><path d="m6.2 6.2 1.8 1.8M17.8 6.2 16 8" /></>,
  arrow: <><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  phone: <path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2C10.6 19.4 4.6 13.4 4 5.2A2 2 0 0 1 6 3Z" />,
  mail: <><path d="M3 6h18v12H3Z" /><path d="m3 7 9 6 9-6" /></>,
  pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></>,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      className={className ? `ico ${className}` : "ico"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] ?? <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

/**
 * The NBSS badge, as supplied by the client.
 *
 * Served from a 256px WebP rather than the 2.6 MB source PNG, and `unoptimized`
 * because that file is already the right size and format — putting a 27 KB
 * asset through `/_next/image` costs a round trip and returns the same bytes.
 *
 * It is an embroidered patch: dense line work, two rings of type and a laurel.
 * That artwork stops resolving somewhere around 40px, which is why the brand
 * lockup keeps the "NBSS" wordmark beside it instead of leaning on the mark
 * alone. Decorative here — the accessible name comes from the adjacent text —
 * so the alt is empty by design.
 */
export function Logo({
  className = "logo",
  size = 40,
  priority = false,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  return (
    <Image
      className={className}
      src="/logo/nbss-256.webp"
      alt=""
      width={size}
      height={size}
      priority={priority}
      unoptimized
    />
  );
}

/** The woven Aronai border, used as the structural rule between page regions. */
export function AronaiBand() {
  return <div className="aronai" role="presentation" aria-hidden="true" />;
}
