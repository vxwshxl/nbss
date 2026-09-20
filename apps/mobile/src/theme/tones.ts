/**
 * The console's pastel tone palette, ported for React Native.
 *
 * Generated from Tailwind's own colour values (see scripts note below), not matched by
 * eye — a Panel's emerald header strip in the app is the same emerald as the one in the
 * browser, so the two read as one product rather than two that look similar.
 *
 * Three differences from apps/web/src/lib/ui/tones.ts, all forced by the platform:
 *
 *   NO DARK VARIANTS. The console disarms Tailwind's dark variant rather than ship a
 *   half-finished dark theme, and the app pins `userInterfaceStyle: "light"` to match.
 *
 *   ALPHA IS PRE-COMPOSITED. The web writes `bg-emerald-50/70`, a translucent tint over
 *   the card. Flattened here against white, because a translucent surface in RN picks up
 *   whatever scrolls beneath it rather than the card it sits on.
 *
 *   NO TAILWIND CLASS STRINGS. Each tone is plain colour values a StyleSheet can use.
 *
 * Regenerate if the console's palette changes.
 */

export type Tone =
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "teal"
  | "indigo"
  | "orange"
  | "cyan"
  | "lime"
  | "pink"
  | "slate";

export type ToneStyle = {
  /** Tinted card background. */
  soft: string;
  /** Icon-chip background, and the ink that goes on it. */
  chip: string;
  chipText: string;
  /** Value / emphasis text. */
  text: string;
  /** The pastel header strip on a Panel, and its title colour. */
  bar: string;
  barText: string;
  /** Hairline border for a tinted surface. */
  ring: string;
  /** A solid colour, for charts and map markers. */
  hex: string;
};

export const TONES: Record<Tone, ToneStyle> = {
  emerald: {
    soft: "#f2fef8",
    chip: "#d9f0e8",
    chipText: "#007a55",
    text: "#006045",
    bar: "#d9fbea",
    barText: "#004f3b",
    ring: "#bff7dd",
    hex: "#00bc7d",
  },
  sky: {
    soft: "#f5fbff",
    chip: "#d9edf8",
    chipText: "#0069a8",
    text: "#00598a",
    bar: "#e5f5fe",
    barText: "#024a70",
    ring: "#cdeefe",
    hex: "#00a6f4",
  },
  violet: {
    soft: "#f8f7ff",
    chip: "#ecdeff",
    chipText: "#7008e7",
    text: "#5d0ec0",
    bar: "#f1edfe",
    barText: "#4d179a",
    ring: "#e7e2ff",
    hex: "#8e51ff",
  },
  amber: {
    soft: "#fffcf1",
    chip: "#fff0d9",
    chipText: "#bb4d00",
    text: "#973c00",
    bar: "#fef5d1",
    barText: "#7b3306",
    ring: "#feeeaa",
    hex: "#fe9a00",
  },
  rose: {
    soft: "#fff5f6",
    chip: "#ffdee6",
    chipText: "#c70036",
    text: "#a50036",
    bar: "#ffe9eb",
    barText: "#8b0836",
    ring: "#ffdbe0",
    hex: "#ff2056",
  },
  teal: {
    soft: "#f5fefc",
    chip: "#d9efed",
    chipText: "#00786f",
    text: "#005f5a",
    bar: "#d5fcf4",
    barText: "#0b4f4a",
    ring: "#b6f9ec",
    hex: "#00bba7",
  },
  indigo: {
    soft: "#f3f6ff",
    chip: "#e5e1fe",
    chipText: "#432dd7",
    text: "#372aac",
    bar: "#e6ecff",
    barText: "#312c85",
    ring: "#d7e0ff",
    hex: "#615fff",
  },
  orange: {
    soft: "#fff9f2",
    chip: "#ffe9d9",
    chipText: "#ca3500",
    text: "#9f2d00",
    bar: "#fff1dd",
    barText: "#7e2a0c",
    ring: "#ffe2c1",
    hex: "#ff6900",
  },
  cyan: {
    soft: "#f2feff",
    chip: "#d9eff4",
    chipText: "#007595",
    text: "#005f78",
    bar: "#d8fbfe",
    barText: "#104e64",
    ring: "#bef7fe",
    hex: "#00b8db",
  },
  lime: {
    soft: "#f9feee",
    chip: "#e7f2d9",
    chipText: "#497d00",
    text: "#3c6300",
    bar: "#f0fdd5",
    barText: "#35530e",
    ring: "#e4fbb8",
    hex: "#7ccf00",
  },
  pink: {
    soft: "#fef6fa",
    chip: "#fbd9ea",
    chipText: "#c6005c",
    text: "#a3004c",
    bar: "#fdecf5",
    barText: "#861043",
    ring: "#fdddef",
    hex: "#f6339a",
  },
  slate: {
    soft: "#fafcfd",
    chip: "#e3e6e9",
    chipText: "#314158",
    text: "#1d293d",
    bar: "#f4f7fa",
    barText: "#0f172b",
    ring: "#ebeff5",
    hex: "#62748e",
  },
};

export const TONE_KEYS = Object.keys(TONES) as Tone[];

/**
 * A stable, varied tone derived from a seed string.
 *
 * Character-for-character the same hash as the console's `toneFor`, so the same label
 * picks the same colour in both — "On duty now" is the same green on a phone as it is on
 * the dashboard, which is what lets somebody find the tile they mean over the phone.
 */
export function toneFor(seed: string, palette: Tone[] = TONE_KEYS): Tone {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length] ?? "slate";
}

export const CHART_TONES: Tone[] = [
  "indigo",
  "emerald",
  "amber",
  "cyan",
  "violet",
  "pink",
  "rose",
  "lime",
  "slate",
];

export function chartColor(i: number): string {
  return TONES[CHART_TONES[i % CHART_TONES.length] ?? "slate"].hex;
}
