"use client";

import { Download } from "lucide-react";
import { useEffect } from "react";

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

export function printDocument(target: PrintTarget) {
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
  return (
    <button
      type="button"
      onClick={() => printDocument(target)}
      className={cn(
        "press inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold whitespace-nowrap text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009164] print:hidden",
        className,
      )}
    >
      <Download className="size-4" />
      {label}
    </button>
  );
}

/**
 * `/brochure?print=onepager` or `?print=brochure` opens with that document chosen for
 * printing, so a link (or a headless PDF render) gets one document without a click.
 */
export function PrintFromQuery() {
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("print");
    if (want === "onepager" || want === "brochure") document.documentElement.dataset.print = want;
  }, []);
  return null;
}
