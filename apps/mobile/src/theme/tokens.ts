/**
 * The design tokens, converted from the web console's oklch values.
 *
 * Two deliberate decisions carried over from apps/web/src/app/globals.css:
 *
 *   LIGHT ONLY. The web console disarms Tailwind's dark variant rather than
 *   shipping a half-finished dark theme (`@custom-variant dark
 *   (&:is(.nbss-never-dark *))`), so the app is light too and `userInterfaceStyle`
 *   is pinned in app.config.ts. A guard's phone set to dark mode gets the same
 *   screen as a supervisor's browser, which is what makes a support call over the
 *   phone possible at all.
 *
 *   THE VALUES ARE HEX, NOT oklch. React Native has no oklch parser. These were
 *   converted once from the authored values rather than eyeballed, so the green on
 *   a check-in button is the same green as on the console.
 *
 * The exception to "match the web" is `sos`: the console has no panic button, and
 * `destructive` — used on delete confirmations — is not loud enough for a screen
 * that has to be understood in half a second at 3am.
 */

export const color = {
  background: "#ffffff",
  appBg: "#f3f4f5",
  foreground: "#0d0d0d",

  card: "#ffffff",
  border: "#e1e1e1",
  line: "#0d0d0d14",
  lineSoft: "#0d0d0d0d",

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

  /** The panic button, and the alarm screen it opens. Nothing else uses these. */
  sos: "#c90019",
  sosDeep: "#940000",

  /** Freshness of a position: live, going stale, out of contact. */
  live: "#00a064",
  stale: "#eab532",
  offline: "#f66d67",

  scrim: "#0000008c",
} as const;

/**
 * A 4px grid. Named by step rather than by use, because a scale that says `md`
 * invites an argument about what is medium; a scale that says `3` does not.
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** `--radius: 0.7rem` on the web, which is 11.2px. Rounded to whole pixels here. */
export const radius = {
  sm: 7,
  md: 9,
  lg: 11,
  xl: 16,
  "2xl": 20,
  full: 999,
} as const;

/**
 * Sizes are a little larger than the web's equivalents on purpose. The console is
 * read at a desk; this is read at arm's length, outdoors, often by someone in their
 * fifties who does not have their glasses on.
 */
export const text = {
  micro: { fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  caption: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 16, lineHeight: 22 },
  bodyLarge: { fontSize: 18, lineHeight: 25 },
  title: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  display: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /** Big enough to read across a room — the clock, and the count on the duty screen. */
  hero: { fontSize: 44, lineHeight: 48, letterSpacing: -1.2 },
} as const;

export const weight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Android draws elevation, iOS draws a shadow, and passing both to one style leaves
 * a grey box on Android. `shadow.card` gives each platform the one it understands.
 */
export const shadow = {
  card: {
    shadowColor: "#0d0d0d",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: "#0d0d0d",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

/**
 * The minimum a finger can reliably hit. 48 rather than Apple's 44, because the
 * people using this are frequently wearing gloves.
 */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const TOUCH_MIN = 48;
