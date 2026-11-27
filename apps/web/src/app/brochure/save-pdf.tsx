"use client";

import { Download } from "lucide-react";

import { cn } from "@/lib/utils";

/** Opens the print sheet, where "Save as PDF" gives the A4 brochure (see brochure.css). */
export function SavePdf({ className, label = "Save as PDF" }: { className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        "press inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 print:hidden",
        className,
      )}
    >
      <Download className="size-4" />
      {label}
    </button>
  );
}
