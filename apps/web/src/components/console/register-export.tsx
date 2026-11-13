"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { OUTCOME } from "@/components/console/attendance-key";
import type { SheetRow } from "@/components/console/attendance-views";
import { Button } from "@/components/ui/button";
import type { Column } from "@/components/ui/data-table";
import { TablePrintPreview } from "@/components/ui/table-print-preview";
import { writeSheet } from "@/lib/excel-export";
import { cn } from "@/lib/utils";

const hours = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}m` : ""}`;
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "narrow", timeZone: "UTC" });

/**
 * Print and Excel for the day-by-day register. The printout keeps the coloured letters
 * (landscape, a column per day); the spreadsheet has a letter per day and the totals as
 * numbers, so it can be summed.
 */
export function RegisterExport({ title, days, sheet }: { title: string; days: string[]; sheet: SheetRow[] }) {
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const columns: Column<SheetRow>[] = [
    {
      header: "Guard",
      cell: (r) => (
        <span className="block whitespace-nowrap">
          <span className="block font-semibold">{r.name}</span>
          <span className="font-mono text-[0.85em] text-muted-foreground">{r.code}</span>
        </span>
      ),
    },
    ...days.map(
      (d, i): Column<SheetRow> => ({
        header: (
          <span className="block text-center leading-tight">
            <span className="block text-[0.8em] uppercase">{weekday(d)}</span>
            {Number(d.slice(8))}
          </span>
        ),
        headClassName: "text-center",
        className: "text-center",
        cell: (r) => {
          const m = r.marks[i];
          return m ? (
            <span className={cn("mx-auto grid size-[1.7em] place-items-center rounded font-bold", OUTCOME[m].cell)}>{OUTCOME[m].letter}</span>
          ) : null;
        },
      }),
    ),
    { header: "P", headClassName: "text-right", className: "text-right font-semibold tabular-nums", cell: (r) => r.present, total: (rs) => rs.reduce((n, r) => n + r.present, 0) },
    { header: "L", headClassName: "text-right", className: "text-right tabular-nums", cell: (r) => r.late, total: (rs) => rs.reduce((n, r) => n + r.late, 0) },
    { header: "A", headClassName: "text-right", className: "text-right font-semibold tabular-nums", cell: (r) => r.absent, total: (rs) => rs.reduce((n, r) => n + r.absent, 0) },
    { header: "Hours", headClassName: "text-right", className: "text-right whitespace-nowrap tabular-nums", cell: (r) => hours(r.minutes), total: (rs) => hours(rs.reduce((n, r) => n + r.minutes, 0)) },
  ];

  const excel = async () => {
    setExporting(true);
    try {
      const sum = (f: (r: SheetRow) => number) => sheet.reduce((n, r) => n + f(r), 0);
      await writeSheet({
        title,
        head: ["Guard", "Code", ...days.map((d) => `${Number(d.slice(8))} ${weekday(d)}`), "Present", "Late", "Absent", "Hours"],
        body: sheet.map((r) => [
          r.name,
          r.code,
          // Upcoming duties are not yet a mark.
          ...r.marks.map((m) => (m && m !== "upcoming" ? OUTCOME[m].letter : "")),
          r.present,
          r.late,
          r.absent,
          Math.round(r.minutes / 6) / 10,
        ]),
        totals: ["Total", "", ...days.map(() => ""), String(sum((r) => r.present)), String(sum((r) => r.late)), String(sum((r) => r.absent)), String(Math.round(sum((r) => r.minutes) / 6) / 10)],
      });
    } catch (e) {
      console.error(e);
      toast.error("The Excel file could not be made. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={sheet.length === 0} onClick={() => setPrinting(true)}>
        <Printer data-icon="inline-start" /> Print
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={sheet.length === 0 || exporting} onClick={excel}>
        {exporting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <FileSpreadsheet data-icon="inline-start" />} Excel
      </Button>
      <TablePrintPreview open={printing} onClose={() => setPrinting(false)} title={title} columns={columns} rows={sheet} getRowKey={(r) => r.id} wide />
    </div>
  );
}
