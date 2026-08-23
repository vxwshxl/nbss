"use client";

import { useId, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import {
  PAGE_SIZES,
  useTableControls,
  type SortDir,
} from "@/lib/hooks/useTableControls";

export type Column<T> = {
  /** Also the sorter's name when `sort` is given. */
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Provide a comparator to make the column's header sortable. */
  sort?: (a: T, b: T) => number;
  /** Mono, tabular figures — for codes, times, distances and counts. */
  mono?: boolean;
  /** Which way this column sorts on first click. Times want newest first. */
  defaultDir?: SortDir;
};

/**
 * The console's one table.
 *
 * Search, a date range, sortable headers and pagination, over a list the page
 * has already fetched. Every console table goes through this so the controls
 * sit in the same place and behave the same way on each — which matters more
 * for a screen somebody uses every day than any individual table's layout.
 *
 * Columns carry render and compare functions, so this cannot be handed props
 * by a Server Component directly. Each table has a small client wrapper that
 * defines its columns and receives plain rows from the page.
 */
export function DataTable<T>({
  rows,
  columns,
  getKey,
  searchFields,
  dateField,
  searchPlaceholder = "Search…",
  dateLabel = "Filter by date",
  initialSort,
  initialDir,
  persistKey,
  empty,
  filteredEmpty = "Nothing matches those filters.",
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  searchFields?: (row: T) => (string | null | undefined)[];
  dateField?: (row: T) => string | null | undefined;
  searchPlaceholder?: string;
  dateLabel?: string;
  initialSort?: string;
  initialDir?: SortDir;
  persistKey?: string;
  /** Shown when the table has no rows at all, before any filtering. */
  empty: { title: string; body: ReactNode };
  /** Shown when filters exclude everything. */
  filteredEmpty?: string;
}) {
  const searchId = useId();

  const sorters = Object.fromEntries(
    columns.filter((c) => c.sort).map((c) => [c.key, c.sort!]),
  ) as Record<string, (a: T, b: T) => number>;

  const t = useTableControls(rows, {
    searchFields,
    dateField,
    sorters,
    initialSort,
    initialDir,
    persistKey,
  });

  // No rows at all is a different message from no rows matching — the first
  // says "nothing has happened yet", the second says "your filters are wrong".
  if (rows.length === 0) {
    return (
      <p className="cempty">
        <strong>{empty.title}</strong>
        {empty.body}
      </p>
    );
  }

  const start = (t.page - 1) * t.perPage + 1;
  const end = Math.min(t.total, t.page * t.perPage);

  return (
    <>
      <div className="ctools">
        <div className="ctools__search">
          <Icon name="search" />
          <input
            id={searchId}
            className="ctools__input"
            type="search"
            value={t.query}
            onChange={(e) => t.setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>

        {dateField && (
          <div className="ctools__dates" role="group" aria-label={dateLabel}>
            <input
              className="ctools__date"
              type="date"
              value={t.from}
              onChange={(e) => t.setFrom(e.target.value)}
              aria-label="From date"
              max={t.to || undefined}
            />
            <span className="ctools__arrow" aria-hidden="true">
              →
            </span>
            <input
              className="ctools__date"
              type="date"
              value={t.to}
              onChange={(e) => t.setTo(e.target.value)}
              aria-label="To date"
              min={t.from || undefined}
            />
            {t.hasDateFilter && (
              <button className="btn btn--ghost btn--sm" type="button" onClick={t.clearDates}>
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {t.total === 0 ? (
        <p className="cempty">
          <strong>{filteredEmpty}</strong>
          Try a different search, or clear the date range.
        </p>
      ) : (
        <div className="ctable-scroll">
          <table className="ctable">
            <thead>
              <tr>
                {columns.map((col) => {
                  const active = t.sortKey === col.key;
                  return (
                    <th key={col.key} scope="col" aria-sort={
                      active ? (t.dir === "asc" ? "ascending" : "descending") : undefined
                    }>
                      {col.sort ? (
                        <button
                          className={`csort${active ? " is-on" : ""}`}
                          type="button"
                          onClick={() => t.toggleSort(col.key, col.defaultDir)}
                        >
                          {col.label}
                          <span className="csort__mark" aria-hidden="true">
                            {active ? (t.dir === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={getKey(row)}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.mono ? "mono" : undefined}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={t.page}
        totalPages={t.totalPages}
        perPage={t.perPage}
        total={t.total}
        start={start}
        end={end}
        onPage={t.setPage}
        onPerPage={t.setPerPage}
      />
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  perPage,
  total,
  start,
  end,
  onPage,
  onPerPage,
}: {
  page: number;
  totalPages: number;
  perPage: number;
  total: number;
  start: number;
  end: number;
  onPage: (page: number) => void;
  onPerPage: (size: number) => void;
}) {
  if (total === 0) return null;

  return (
    <div className="cpage">
      <label className="cpage__size">
        <span>Rows</span>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="cpage__nav">
        <span className="cpage__count">
          {start}–{end} of {total}
        </span>
        <button
          className="icon-btn"
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ←
        </button>
        <span className="cpage__of">
          {page} / {totalPages}
        </span>
        <button
          className="icon-btn"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </div>
  );
}
