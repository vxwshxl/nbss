"use client";

// Browser extensions (Bitdefender, ColorZilla, Grammarly, LanguageTool, …)
// inject attributes into the DOM *before* React hydrates, producing noisy
// hydration-mismatch warnings that aren't real bugs. We drop ONLY those — any
// warning that mentions one of these extension attributes — so genuine
// hydration issues still show up.
const EXTENSION_MARKERS = [
  "bis_skin_checked", // Bitdefender
  "cz-shortcut-listen", // ColorZilla
  "data-new-gr-c-s-check-loaded", // Grammarly
  "data-gr-ext-installed", // Grammarly
  "data-lt-installed", // LanguageTool
  "__processed_", // various
  "data-darkreader", // Dark Reader
];

declare global {
  var __extWarnPatched: boolean | undefined;
}

if (typeof window !== "undefined" && !window.__extWarnPatched) {
  window.__extWarnPatched = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => (typeof a === "string" ? a : ""))
      .join(" ");
    if (EXTENSION_MARKERS.some((m) => text.includes(m))) return;
    original.apply(console, args as []);
  };
}

/** Mounted once at the app root; the side effect above runs on import. */
export function SuppressExtensionWarnings() {
  return null;
}
