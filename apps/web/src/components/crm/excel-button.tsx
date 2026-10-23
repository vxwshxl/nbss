"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { writeSheet } from "@/lib/excel-export";

/** Excel export for a table rendered on the server: it hands over its rows as plain values. */
export function ExcelButton({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy || rows.length === 0}
      onClick={async () => {
        setBusy(true);
        try {
          await writeSheet({ title, head, body: rows });
        } catch (e) {
          console.error(e);
          toast.error("The Excel file could not be made. Try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-border bg-elevated px-3.5 text-[13px] font-medium hover:bg-subtle disabled:opacity-40"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4 text-primary-ink" />} Excel
    </button>
  );
}
