import { staticFile } from "remotion";

/** The site's own palette (apps/web globals.css), so the film looks like the product. */
export const C = {
  bg: "#03170f",
  bg2: "#062a1f",
  ink: "#f4fbf8",
  muted: "rgba(226, 244, 236, 0.62)",
  faint: "rgba(226, 244, 236, 0.14)",
  emerald: "#10b981",
  mint: "#34d399",
  teal: "#2dd4bf",
  deep: "#047857",
  rose: "#f43f5e",
  amber: "#f59e0b",
  gradient: "linear-gradient(135deg, #047857 0%, #059669 45%, #10b981 100%)",
  bright: "linear-gradient(90deg, #6ee7b7 0%, #a7f3d0 50%, #99f6e4 100%)",
};

export const FONT = "Geist, ui-sans-serif, system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";

export const fontCss = `
@font-face { font-family: "Geist"; src: url("${staticFile("fonts/geist-sans-variable.woff2")}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Geist Mono"; src: url("${staticFile("fonts/geist-mono-variable.woff2")}") format("woff2"); font-weight: 100 900; }
`;

/** Ease-out used for everything that arrives. */
export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
export const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
