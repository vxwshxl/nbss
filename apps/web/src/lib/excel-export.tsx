import type { ReactNode } from "react";

import type { SheetData } from "write-excel-file/browser";

import { site } from "@/content/site";

/** What a table hands over: its columns as header + cell renderers, and the rows on screen. */
export type ExportColumn<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  total?: (rows: T[]) => ReactNode;
};

/**
 * Writes rows to a real .xlsx and saves it. Each cell is rendered to plain text the
 * way it reads on screen (so a status pill becomes "On time", a name with its code
 * "Ravi Basumatary NBSS-014"), and plain numbers become numbers Excel can sum.
 *
 * Both libraries are loaded only when someone exports, so no page pays for them.
 */
export async function exportToExcel<T>({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<void> {
  const { renderToStaticMarkup } = await import("react-dom/server");

  const parser = new DOMParser();
  const text = (node: ReactNode): string => {
    if (node === null || node === undefined || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node).trim();
    // A space after every closing tag, so "<b>Name</b><span>Code</span>" reads as two words.
    const html = renderToStaticMarkup(<>{node}</>).replace(/<\/[^>]+>/g, "$& ").replace(/<br\s*\/?>/g, " ");
    return (parser.parseFromString(html, "text/html").body.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const head = columns.map((c) => text(c.header) || " ");
  const body = rows.map((r) => columns.map((c) => text(c.cell(r))));
  const totals = columns.some((c) => c.total) ? columns.map((c) => (c.total ? text(c.total(rows)) : "")) : null;
  await writeSheet({ title, head, body, totals });
}

/** Saves already-plain rows as an .xlsx: the shared half of every export. */
export async function writeSheet({
  title,
  head,
  body,
  totals = null,
}: {
  title: string;
  head: string[];
  body: (string | number)[][];
  totals?: string[] | null;
}): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const cellValue = (raw: string | number) => {
    if (typeof raw === "number") return { value: raw, type: Number };
    const value = raw;
    // Sums as a number: "42", "1,250", "3.5". Codes with a leading zero and long digit
    // strings (phone numbers) stay text, or Excel would mangle them.
    const bare = value.replace(/,(?=\d{3}\b)/g, "");
    if (/^-?(0|[1-9]\d{0,8})(\.\d+)?$/.test(bare)) return { value: Number(bare), type: Number };
    if (value === "-" || value === "") return null;
    return { value, type: String };
  };

  const stamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: site.timeZone });
  const span = Math.max(1, head.length);
  const pad = (n: number) => Array.from({ length: n }, () => null);

  const sheet: SheetData = [
    [{ value: `${site.shortName} · ${title}`, fontWeight: "bold" as const, fontSize: 14, columnSpan: span }, ...pad(span - 1)],
    [{ value: `${body.length} ${body.length === 1 ? "row" : "rows"} · exported ${stamp} IST`, textColor: "#5d5d5d", columnSpan: span }, ...pad(span - 1)],
    pad(span),
    head.map((h) => ({ value: h, fontWeight: "bold" as const, backgroundColor: "#0d2a1f", textColor: "#ffffff" })),
    ...body.map((r) => r.map(cellValue)),
    ...(totals ? [totals.map((v, i) => (i === 0 && !v ? { value: "Total", fontWeight: "bold" as const } : { ...(cellValue(v) ?? { value: "" }), fontWeight: "bold" as const }))] : []),
  ];

  const widths = head.map((h, i) => ({
    width: Math.min(48, Math.max(10, h.length + 2, ...body.map((r) => String(r[i] ?? "").length + 2))),
  }));

  const name = `${site.shortName}-${title}`.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  const date = new Date().toLocaleDateString("en-CA", { timeZone: site.timeZone });
  await writeXlsxFile(sheet, { columns: widths, sheet: title.slice(0, 31) }).toFile(`${name}-${date}.xlsx`);
}
