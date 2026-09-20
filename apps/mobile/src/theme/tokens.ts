import { Platform } from "react-native";

/**
 * The design tokens, ported from apps/web/src/app/globals.css.
 *
 * The goal is that the app and the console read as one product — the same green, the
 * same Geist, the same 20px card radius — so somebody who uses the browser at a desk
 * and the app at a gate is not learning two interfaces.
 *
 * Three decisions carried over from the web deliberately:
 *
 *   LIGHT ONLY. The console disarms Tailwind's dark variant (`@custom-variant dark
 *   (&:is(.nbss-never-dark *))`) rather than ship a half-finished dark theme, so the app
 *   pins `userInterfaceStyle: "light"` to match.
 *
 *   HEX, NOT oklch. React Native has no oklch parser. These were converted once from the
 *   authored values rather than eyeballed.
 *
 *   THE WEB'S SCALE, NOT A MOBILE ONE. The type sizes and radii below are the console's
 *   computed values, so a Panel here is the same shape as a Panel there. The exception
 *   is hit targets, which are a physical constraint rather than a visual one.
 */

export const color = {
  background: "#ffffff",
  /** `--app-bg`: the very slightly cool grey the console's cards float on. */
  appBg: "#f3f4f5",
  foreground: "#0d0d0d",

  card: "#ffffff",
  border: "#e1e1e1",
  /** `--app-line` / `--app-line-soft`, flattened. Panels use the soft one. */
  line: "#ebebeb",
  lineSoft: "#f1f1f1",

  primary: "#00925b",
  primaryForeground: "#fcfcfc",
  brand: "#19a96e",

  muted: "#f3f3f3",
  mutedForeground: "#5d5d5d",

  accent: "#e7f4ec",
  accentForeground: "#113c27",

  secondary: "#f3f3f3",
  secondaryForeground: "#0f0f0f",

  destructive: "#cc2826",
  destructiveForeground: "#fcfcfc",

  /** The panic button and the alarm screen. Nothing else uses these. */
  sos: "#c90019",
  sosDeep: "#940000",

  /** Freshness of a position: live, going stale, out of contact. */
  live: "#00a064",
  stale: "#eab532",
  offline: "#f66d67",

  scrim: "#0000008c",
} as const;

/**
 * Geist, the same family the website serves from `public/fonts`.
 *
 * The web loads a variable woff2; React Native cannot use woff2 or variable axes, so the
 * static weights come from `@expo-google-fonts/geist` and each weight is its own family
 * name. That is why weight is set with `fontFamily` below rather than `fontWeight` —
 * setting `fontWeight` on a static font either does nothing or makes the platform
 * synthesise a fake bold, which looks visibly wrong next to the real thing.
 */
export const font = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

/** Tailwind's scale, which is what the console's classes resolve to. */
export const size = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

/**
 * Named styles matching the console's own usages, so a screen says `variant="statValue"`
 * rather than restating `text-4xl font-semibold tracking-tight tabular-nums` each time.
 */
export const text = {
  /** PageHeader's eyebrow: `text-[11px] font-bold tracking-[0.16em] uppercase`. */
  eyebrow: { fontSize: 11, lineHeight: 14, letterSpacing: 1.76 },
  /** PageHeader's title: `text-3xl font-semibold tracking-tight`. */
  pageTitle: { fontSize: size["3xl"], lineHeight: 36, letterSpacing: -0.6 },
  /** Panel header strip: `text-sm font-bold sm:text-base`. */
  panelTitle: { fontSize: size.base, lineHeight: 22, letterSpacing: -0.2 },
  /** StatCard's figure: `text-4xl font-semibold tracking-tight tabular-nums`. */
  statValue: { fontSize: size["4xl"], lineHeight: 40, letterSpacing: -0.9 },
  /** The biggest number on a screen — the on-duty count, the clock. */
  hero: { fontSize: size["5xl"], lineHeight: 52, letterSpacing: -1.4 },

  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  caption: { fontSize: size.xs, lineHeight: 16 },
  label: { fontSize: size.sm, lineHeight: 20 },
  body: { fontSize: size.base, lineHeight: 24 },
  bodyLarge: { fontSize: size.lg, lineHeight: 28 },
  title: { fontSize: size.xl, lineHeight: 28, letterSpacing: -0.3 },
  sectionTitle: { fontSize: size["2xl"], lineHeight: 32, letterSpacing: -0.5 },
} as const;

/** A 4px grid, matching Tailwind's spacing steps. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/**
 * `--radius: 0.7rem`, with the console's multipliers applied. A Panel is `rounded-2xl`,
 * which resolves to 0.7 × 1.8 = 1.26rem ≈ 20px — not Tailwind's stock 16px.
 */
export const radius = {
  sm: 7,
  md: 9,
  lg: 11,
  xl: 16,
  "2xl": 20,
  "3xl": 25,
  full: 999,
} as const;

/**
 * `shadow-card` and `shadow-raised`.
 *
 * Android draws `elevation`, iOS draws the shadow properties, and handing one style both
 * leaves a grey box on Android — so each platform gets only what it understands.
 */
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#0d0d0d",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 1 },
  }),
  raised: Platform.select({
    ios: {
      shadowColor: "#0d0d0d",
      shadowOpacity: 0.09,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    default: { elevation: 5 },
  }),
} as const;

/**
 * The minimum a finger can reliably hit — 48 rather than Apple's 44, because the people
 * using this are frequently wearing gloves. This is the one place the app deliberately
 * departs from the console's sizing: a mouse is precise and a wet thumb is not.
 */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const TOUCH_MIN = 48;
