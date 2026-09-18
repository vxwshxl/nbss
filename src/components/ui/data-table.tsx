"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  SearchX,
  Inbox,
  Printer,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePrintPreview } from "@/components/ui/table-print-preview";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const PAGE_SIZES = [20, 50, 100, 500, 1000, 2000, 5000] as const;

export type Column<T> = {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
  /** Provide to make the column sortable (renders up/down icons in the header). */
  sortValue?: (row: T) => string | number;
  /** Text this column contributes to the global search box. */
  searchValue?: (row: T) => string;
  /** Exclude this column from the print preview (e.g. row-action buttons). */
  noPrint?: boolean;
  /** Print-friendly cell (usually plain text); falls back to `cell` when absent. */
  printCell?: (row: T) => React.ReactNode;
  /** Header shown in the print preview when it should differ from `header`. */
  printHeader?: React.ReactNode;
  /**
   * When set, the print preview renders a totals row at the bottom; this column
   * shows the returned value (e.g. a summed amount). If no column defines
   * `total`, no totals row is printed.
   */
  total?: (rows: T[]) => React.ReactNode;
};

type SortState = { index: number; dir: "asc" | "desc" } | null;

function compare(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  emptyMessage = "Nothing here yet.",
  initialPageSize = 20,
  searchPlaceholder = "Search…",
  toolbar,
  interactiveRows = false,
  printTitle,
  rowClassName,
  rowPreview = true,
  previewTitle,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  getRowKey: (row: T, index: number) => string;
  emptyMessage?: string;
  initialPageSize?: number;
  searchPlaceholder?: string;
  /** Actions rendered on the right of the search bar (e.g. a create button). */
  toolbar?: React.ReactNode;
  /** Optional per-row tint for actionable states (e.g. overdue loans, defaulters). */
  rowClassName?: (row: T) => string | undefined;
  /**
   * Enables the print preview. When set, a Print button appears in the toolbar;
   * the preview prints all filtered + sorted rows under a branded header titled
   * with this value (e.g. "Students").
   */
  printTitle?: string;
  /**
   * When true, clicking a row triggers its primary action — the element marked
   * `data-row-primary` (a "view" link if present, otherwise the "edit" button).
   * Clicks on other controls (edit/delete/links) keep their own behaviour.
   *
   * Rows are clickable either way — see `rowPreview`. This only decides
   * whether the row *looks* clickable before you try it.
   */
  interactiveRows?: boolean;
  /**
   * Fallback for a row with no primary action: clicking it opens a read-only
   * dialog of that row's columns. On by default so no table is a dead end —
   * pass `false` where a row genuinely has nothing more to show than the line
   * already on screen.
   */
  rowPreview?: boolean;
  /** Heading for that dialog; defaults to the first column's value. */
  previewTitle?: (row: T) => string;
  /**
   * Handles a row click directly, in place of the `data-row-primary` element
   * and the fallback preview dialog.
   *
   * The `data-row-primary` mechanism suits a table whose rows already carry a
   * link or an edit button — it fires the control that is visibly there. It
   * suits a table whose row opens a panel far less well, because the only way
   * to express that is a hidden button planted in a cell purely to be clicked
   * by script. Where the row *is* the control, say so.
   */
  onRowClick?: (row: T) => void;
}) {
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [printing, setPrinting] = useState(false);
  const [preview, setPreview] = useState<T | null>(null);

  const searchable = columns.some((c) => c.searchValue);

  // Filter → sort → paginate.
  const processed = useMemo(() => {
    let rows = data;

    const q = query.trim().toLowerCase();
    if (q && searchable) {
      rows = rows.filter((row) =>
        columns.some((c) =>
          c.searchValue?.(row).toLowerCase().includes(q),
        ),
      );
    }

    if (sort) {
      const col = columns[sort.index];
      if (col?.sortValue) {
        const factor = sort.dir === "asc" ? 1 : -1;
        rows = [...rows].sort(
          (a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * factor,
        );
      }
    }

    return rows;
  }, [data, columns, query, searchable, sort]);

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize));
  const current = Math.min(page, pageCount - 1);

  const rows = useMemo(
    () => processed.slice(current * pageSize, current * pageSize + pageSize),
    [processed, current, pageSize],
  );

  // A row responds to a click when it has a primary action to fire or a
  // preview to fall back on — which, with rowPreview defaulting on, is every
  // table that hasn't opted out.
  const clickableRows = interactiveRows || rowPreview || !!onRowClick;

  const from = processed.length === 0 ? 0 : current * pageSize + 1;
  const to = Math.min(processed.length, current * pageSize + pageSize);

  // Fire a row's primary action, unless the click/keypress landed on its own
  // control (button/link/input) which should handle itself.
  function activateRow(e: React.MouseEvent | React.KeyboardEvent, row: T) {
    const root = e.currentTarget as HTMLElement;
    const target = e.target as HTMLElement;
    if (
      target !== root &&
      target.closest('a, button, input, select, textarea, label, [role="checkbox"], [data-no-row-activate]')
    ) {
      return;
    }
    if (onRowClick) {
      onRowClick(row);
      return;
    }
    const primary = root.querySelector<HTMLElement>("[data-row-primary]");
    if (primary) {
      primary.click();
      return;
    }
    if (rowPreview) setPreview(row);
  }

  function toggleSort(index: number) {
    setPage(0);
    setSort((prev) => {
      if (!prev || prev.index !== index) return { index, dir: "asc" };
      if (prev.dir === "asc") return { index, dir: "desc" };
      return null; // third click clears sorting
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card print:shadow-none">
      {(searchable || toolbar || printTitle) && (
        <div className="flex items-center gap-2 border-b border-app-line-soft px-4 py-3">
          {searchable && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {printTitle && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrinting(true)}
                disabled={processed.length === 0}
              >
                <Printer className="size-4" /> Print
              </Button>
            )}
            {toolbar}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="border-0 bg-foreground hover:bg-foreground">
            {columns.map((c, i) => {
              const sortable = !!c.sortValue;
              const active = sort?.index === i;
              return (
                <TableHead
                  key={i}
                  className={cn(
                    "h-12 text-xs font-semibold tracking-wide text-background uppercase",
                    c.headClassName,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(i)}
                      className="-mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:text-background/70"
                    >
                      {c.header}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                  <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {query.trim() ? (
                      <SearchX className="size-5" strokeWidth={1.75} />
                    ) : (
                      <Inbox className="size-5" strokeWidth={1.75} />
                    )}
                  </div>
                  {query.trim() ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          No matches for &ldquo;{query.trim()}&rdquo;
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Check the spelling, or search for something broader.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setPage(0);
                        }}
                      >
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {emptyMessage}
                    </p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow
                key={getRowKey(row, i)}
                className={cn(
                  "h-16",
                  clickableRows &&
                    "cursor-pointer hover:bg-accent/40 active:bg-accent/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  rowClassName?.(row),
                )}
                tabIndex={clickableRows ? 0 : undefined}
                onClick={clickableRows ? (e) => activateRow(e, row) : undefined}
                onKeyDown={
                  clickableRows
                    ? (e) => {
                        if (e.key === "Enter") activateRow(e, row);
                      }
                    : undefined
                }
              >
                {columns.map((c, ci) => (
                  <TableCell key={ci} className={cn("px-4", c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-line-soft px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(0);
            }}
          >
            <SelectTrigger size="sm" className="w-[5.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 text-muted-foreground">
          <span className="tabular-nums">
            {from}&ndash;{to} of {processed.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current === 0}
              onClick={() => setPage(0)}
              aria-label="First page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 tabular-nums text-foreground">
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(pageCount - 1)}
              aria-label="Last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {printTitle && (
        <TablePrintPreview
          open={printing}
          onClose={() => setPrinting(false)}
          title={printTitle}
          columns={columns}
          rows={processed}
          getRowKey={getRowKey}
        />
      )}

      <RowPreviewDialog
        row={preview}
        columns={columns}
        title={preview && previewTitle ? previewTitle(preview) : undefined}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

/**
 * What a row shows when it has nothing else to open: its own columns, read
 * only, laid out label over value. Built from the column definitions the table
 * already has, so a table gets this for free and it can never drift from what
 * the row renders.
 *
 * Action columns are skipped — they carry no header and are already marked
 * `noPrint` for the same reason.
 */
function RowPreviewDialog<T>({
  row,
  columns,
  title,
  onClose,
}: {
  row: T | null;
  columns: Column<T>[];
  title?: string;
  onClose: () => void;
}) {
  const fields = columns.filter((c) => c.header && !c.noPrint);

  return (
    <Dialog open={row !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? "Details"}</DialogTitle>
        </DialogHeader>
        {row !== null && (
          <dl className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
            {fields.map((c, i) => (
              <div key={i} className="min-w-0">
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                  {c.header}
                </dt>
                <dd className="mt-1 text-sm font-medium break-words">
                  {c.cell(row)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}
