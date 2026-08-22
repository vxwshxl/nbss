"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";

/**
 * Light / dark / system, cycled from one button.
 *
 * The choice is stored under `THEME_KEY` and applied by stamping `data-theme`
 * on <html>; the stylesheet reads that attribute, and "system" is the value
 * the server renders, so a reader who never touches this button gets their OS
 * preference through the media query alone — no JavaScript, no flash.
 *
 * The blocking script in the document head (see `themeScript` below) restamps
 * the stored value before first paint. Without it, a reader who chose dark
 * would get a white flash on every navigation while React caught up.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "nbss-theme";

/** system → light → dark → system. */
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };

const LABEL: Record<Theme, string> = {
  system: "Theme: system",
  light: "Theme: light",
  dark: "Theme: dark",
};

const GLYPH: Record<Theme, string> = { system: "monitor", light: "sun", dark: "moon" };

/**
 * Runs before paint, inlined into <head>. Deliberately terse and dependency
 * free — it is parsed and executed on every page load, ahead of the CSS.
 */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  /* Starts at the server-rendered value so the first client render matches the
     markup React was given; the effect below then corrects it to what the
     head script already applied. */
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  const cycle = () => {
    const next = NEXT[theme];
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Private mode, or storage disabled. The choice still holds for this
         page — it simply will not survive a reload, which is the right
         failure for a preference this cheap to set again. */
    }
  };

  return (
    <button
      className="icon-btn theme-btn"
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[theme]}. Change theme.`}
      title={LABEL[theme]}
    >
      <Icon name={GLYPH[theme]} />
    </button>
  );
}
