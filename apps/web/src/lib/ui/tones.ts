// Centralized pastel tone palette. One source of truth for the app's colourful
// surfaces — StatCards, Panels, status pills, tiles and charts all import from
// here so a row of cards reads as one system and recolouring happens in a single
// place (see the "recolor via tokens, not per-page" project note).
//
// Each tone ships:
//   soft  — tinted card background (light + dark)
//   chip  — icon-chip background + text
//   text  — value / emphasis text
//   bar   — pastel header strip used by <Panel>
//   ring  — hairline border for tinted surfaces
//   hex   — a solid colour for SVG charts (theme-agnostic)

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
  soft: string;
  chip: string;
  text: string;
  bar: string;
  ring: string;
  hex: string;
};

export const TONES: Record<Tone, ToneStyle> = {
  emerald: {
    soft: "bg-emerald-50/70 dark:bg-emerald-950/25",
    chip: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-800 dark:text-emerald-200",
    bar: "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
    ring: "border-emerald-200/70 dark:border-emerald-500/20",
    hex: "#10b981",
  },
  sky: {
    soft: "bg-sky-50/70 dark:bg-sky-950/25",
    chip: "bg-sky-600/15 text-sky-700 dark:text-sky-300",
    text: "text-sky-800 dark:text-sky-200",
    bar: "bg-sky-100/80 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200",
    ring: "border-sky-200/70 dark:border-sky-500/20",
    hex: "#0ea5e9",
  },
  violet: {
    soft: "bg-violet-50/70 dark:bg-violet-950/25",
    chip: "bg-violet-600/15 text-violet-700 dark:text-violet-300",
    text: "text-violet-800 dark:text-violet-200",
    bar: "bg-violet-100/80 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200",
    ring: "border-violet-200/70 dark:border-violet-500/20",
    hex: "#8b5cf6",
  },
  amber: {
    soft: "bg-amber-50/70 dark:bg-amber-950/25",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    text: "text-amber-800 dark:text-amber-200",
    bar: "bg-amber-100/80 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
    ring: "border-amber-200/70 dark:border-amber-500/20",
    hex: "#f59e0b",
  },
  rose: {
    soft: "bg-rose-50/70 dark:bg-rose-950/25",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    text: "text-rose-800 dark:text-rose-200",
    bar: "bg-rose-100/80 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200",
    ring: "border-rose-200/70 dark:border-rose-500/20",
    hex: "#f43f5e",
  },
  teal: {
    soft: "bg-teal-50/70 dark:bg-teal-950/25",
    chip: "bg-teal-600/15 text-teal-700 dark:text-teal-300",
    text: "text-teal-800 dark:text-teal-200",
    bar: "bg-teal-100/80 text-teal-900 dark:bg-teal-500/15 dark:text-teal-200",
    ring: "border-teal-200/70 dark:border-teal-500/20",
    hex: "#14b8a6",
  },
  indigo: {
    soft: "bg-indigo-50/70 dark:bg-indigo-950/25",
    chip: "bg-indigo-600/15 text-indigo-700 dark:text-indigo-300",
    text: "text-indigo-800 dark:text-indigo-200",
    bar: "bg-indigo-100/80 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-200",
    ring: "border-indigo-200/70 dark:border-indigo-500/20",
    hex: "#6366f1",
  },
  orange: {
    soft: "bg-orange-50/70 dark:bg-orange-950/25",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    text: "text-orange-800 dark:text-orange-200",
    bar: "bg-orange-100/80 text-orange-900 dark:bg-orange-500/15 dark:text-orange-200",
    ring: "border-orange-200/70 dark:border-orange-500/20",
    hex: "#f97316",
  },
  cyan: {
    soft: "bg-cyan-50/70 dark:bg-cyan-950/25",
    chip: "bg-cyan-600/15 text-cyan-700 dark:text-cyan-300",
    text: "text-cyan-800 dark:text-cyan-200",
    bar: "bg-cyan-100/80 text-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-200",
    ring: "border-cyan-200/70 dark:border-cyan-500/20",
    hex: "#06b6d4",
  },
  lime: {
    soft: "bg-lime-50/70 dark:bg-lime-950/25",
    chip: "bg-lime-600/15 text-lime-700 dark:text-lime-300",
    text: "text-lime-800 dark:text-lime-200",
    bar: "bg-lime-100/80 text-lime-900 dark:bg-lime-500/15 dark:text-lime-200",
    ring: "border-lime-200/70 dark:border-lime-500/20",
    hex: "#84cc16",
  },
  pink: {
    soft: "bg-pink-50/70 dark:bg-pink-950/25",
    chip: "bg-pink-600/15 text-pink-700 dark:text-pink-300",
    text: "text-pink-800 dark:text-pink-200",
    bar: "bg-pink-100/80 text-pink-900 dark:bg-pink-500/15 dark:text-pink-200",
    ring: "border-pink-200/70 dark:border-pink-500/20",
    hex: "#ec4899",
  },
  slate: {
    soft: "bg-slate-50/70 dark:bg-slate-900/40",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    text: "text-slate-800 dark:text-slate-200",
    bar: "bg-slate-100/80 text-slate-900 dark:bg-slate-500/15 dark:text-slate-200",
    ring: "border-slate-200/70 dark:border-slate-500/20",
    hex: "#94a3b8",
  },
};

export const TONE_KEYS = Object.keys(TONES) as Tone[];

/** Stable, varied tone derived from a seed string (e.g. a label) so a row of
 *  cards reads colourful without every call site choosing one explicitly. */
export function toneFor(seed: string, palette: Tone[] = TONE_KEYS): Tone {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length] ?? "slate";
}

/** Solid colours for charts, in a pleasant fixed order. */
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
