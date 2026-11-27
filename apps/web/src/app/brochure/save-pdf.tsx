"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Which document the print sheet shows. `/brochure` holds two: the one-page summary
 * and the full brochure. Printing marks <html data-print="…"> so brochure.css hides
 * the other one; with no mark (Cmd/Ctrl+P) both print, the one-pager first.
 */
export type PrintTarget = "onepager" | "brochure";

/** The PDF's file name comes from the document title while the print sheet is open. */
const PDF_NAMES: Record<PrintTarget, string> = {
  onepager: "NBSS - Company at a glance",
  brochure: "NBSS - Company brochure",
};

const DOC_SELECTOR: Record<PrintTarget, string> = {
  onepager: ".onepager-doc",
  brochure: ".brochure-doc",
};

/**
 * Photos are lazy-loaded, and Chrome's print preview does not fetch the ones nobody
 * has scrolled to: they printed as empty grey boxes. So every image in `scope` is
 * switched to eager and awaited (up to `timeoutMs`, so a slow photo never blocks
 * printing for good).
 */
function loadImages(scope: ParentNode, timeoutMs = 10_000): Promise<void> {
  const imgs = [...scope.querySelectorAll<HTMLImageElement>("img")];
  for (const img of imgs) img.loading = "eager";
  const ready = imgs.map((img) =>
    img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  return Promise.race([
    Promise.all(ready).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function printDocument(target: PrintTarget) {
  const doc = document.querySelector(DOC_SELECTOR[target]);
  if (doc) await loadImages(doc);
  const root = document.documentElement;
  const title = document.title;
  const done = () => {
    delete root.dataset.print;
    document.title = title;
  };
  root.dataset.print = target;
  document.title = PDF_NAMES[target];
  window.addEventListener("afterprint", done, { once: true });
  window.print();
}

export function SavePdf({
  target,
  label,
  className,
}: {
  target: PrintTarget;
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await printDocument(target);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "press inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold whitespace-nowrap text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009164] disabled:cursor-progress disabled:opacity-70 print:hidden",
        className,
      )}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </button>
  );
}

/**
 * Print support for the whole page:
 * - `/brochure?print=onepager` or `?print=brochure` opens with that document chosen
 *   for printing, so a link (or a headless PDF render) gets one document.
 * - Shortly after the page settles, every brochure photo starts loading, so Cmd/Ctrl+P
 *   (which cannot wait for anything) finds them ready rather than blank.
 */
export function PrintSupport() {
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("print");
    if (want === "onepager" || want === "brochure") document.documentElement.dataset.print = want;

    const brochure = document.querySelector(".brochure");
    if (!brochure) return;
    const t = window.setTimeout(() => void loadImages(brochure), 1500);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
