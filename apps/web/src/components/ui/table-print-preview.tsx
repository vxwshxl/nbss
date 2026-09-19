"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRINT_BRANDING as branding } from "@/lib/branding";
import type { Column } from "@/components/ui/data-table";

/**
 * Full-screen, responsive print preview for a `DataTable`. Renders an
 * invoice-style branded header followed by the full (filtered + sorted) row set
 * — pagination is deliberately ignored so the whole view prints. Columns marked
 * `noPrint` (e.g. row actions) are dropped; each remaining cell prints via
 * `printCell` when supplied, else its normal `cell`.
 *
 * On screen it's a scrollable overlay that adapts to any width. On `window.print()`
 * the shell and preview chrome are hidden by the `[data-print-overlay]` rules in
 * `globals.css`, leaving just the document — with the header row repeated on every
 * page and rows kept off page breaks.
 */
export function TablePrintPreview<T>({
  open,
  onClose,
  title,
  columns,
  rows,
  getRowKey,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
}) {

  // Lock background scroll and wire Escape while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const printCols = columns.filter((c) => !c.noPrint);
  const printedAt = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return createPortal(
    <div
      data-print-overlay
      className="table-print-portal fixed inset-0 z-50 flex flex-col bg-black/40"
    >
      {/* Toolbar — screen only */}
      <div className="no-print flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <p className="truncate text-sm font-semibold">{title} · Print preview</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" /> Close
          </Button>
        </div>
      </div>

      {/* Scrollable preview surface. Clicking the surround (not the document)
          dismisses the preview, like a modal backdrop. */}
      <div
        className="print-scroll flex-1 overflow-auto bg-muted/40 p-4 sm:p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          id="table-print-doc"
          className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card print:max-w-none print:rounded-none print:border-0"
        >
          {/* Branded header */}
          <div className="flex items-center gap-4 border-b border-border px-6 py-5 print:px-0 print:py-3">
            {branding.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt=""
                className="size-14 rounded object-contain print:size-10"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold print:text-base">
                {branding.name ?? "Report"}
              </h1>
              {branding.address && (
                <p className="text-xs text-muted-foreground">{branding.address}</p>
              )}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
              <p className="text-sm text-muted-foreground">{printedAt}</p>
              <p className="text-xs text-muted-foreground">{rows.length} records</p>
            </div>
          </div>

          {/* Data */}
          <div className="overflow-x-auto px-6 py-5 print:overflow-visible print:px-0 print:py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  {printCols.map((c, i) => (
                    <th key={i} className="px-2 py-2 font-medium print:py-1">
                      {c.printHeader ?? c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={printCols.length}
                      className="py-10 text-center text-muted-foreground"
                    >
                      Nothing to print.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr key={getRowKey(row, i)}>
                      {printCols.map((c, ci) => (
                        <td key={ci} className="px-2 py-2 align-top print:py-1">
                          {c.printCell ? c.printCell(row) : c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && printCols.some((c) => c.total) && (
                <tfoot>
                  <tr className="border-t-2 border-foreground font-semibold">
                    {printCols.map((c, ci) => (
                      <td key={ci} className={`px-2 py-2 print:py-1 ${c.className ?? ""}`}>
                        {c.total ? c.total(rows) : ci === 0 ? "Total" : null}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
