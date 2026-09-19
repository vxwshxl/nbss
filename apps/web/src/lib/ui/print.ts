// Helpers for the "clean branded printout" pattern: build a full HTML document
// string, then hand it to the platform to print — a hidden iframe on the web
// (printHtml in apps/web/src/lib/ui/print.ts), expo-print in the mobile app.
// Used by leave documents, exam schedules, attendance registers and report cards.

/** School identity printed in document headers (logo, name, address). */
export type PrintBranding = {
  name: string;
  logoUrl: string | null;
  address: string | null;
};

/** Escape a value for safe interpolation into printed HTML. */
export function escHtml(v: string | number | null | undefined): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Inline `<script>` that fits the document onto a single A4 page. It measures the
 * `.doc` block and:
 *  - if it overflows, applies a CSS `zoom` to shrink layout so pagination
 *    genuinely collapses to one page (a `transform` would only shrink pixels,
 *    not page count). Only ever shrinks, never enlarges.
 *  - if `center` is set and it already fits, adds top padding so the content
 *    sits vertically centered on the page (horizontal centering comes from the
 *    doc's `margin: 0 auto`).
 * `landscape` must match the doc's `@page`, which is assumed to have `margin: 0`
 * and the doc body a 40px padding on every side.
 */
export function fitToPageScript(landscape = false, center = false): string {
  const pageMm = landscape ? 210 : 297; // A4 short/long side, in mm
  return `<script>(function(){try{
  var pxPerMm=96/25.4,pageH=${pageMm}*pxPerMm-8;
  var doc=document.querySelector(".doc");
  if(!doc)return;
  var contentH=doc.getBoundingClientRect().height+80;
  if(contentH>pageH){document.body.style.zoom=String(pageH/contentH);}
  else if(${center ? "true" : "false"}){document.body.style.paddingTop=(40+(pageH-contentH)/2)+"px";}
}catch(e){}})();</script>`;
}
