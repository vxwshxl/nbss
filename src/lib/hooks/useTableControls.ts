"use client";

import { useMemo } from "react";

import { usePersistentState } from "./usePersistentState";

export type SortDir = "asc" | "desc";

export const PAGE_SIZES = [20, 50, 100, 250];

/**
 * Search, date range, sorting and pagination for a console table.
 *
 * Everything happens in the browser over a list the server already sent. At
 * the scale this system runs at — a few hundred guards, a few thousand punches
 * a month — that is the right trade: filtering is instant, with no round trip
 * per keystroke.
 *
 * It stops being right once a table holds tens of thousands of rows, which
 * attendance eventually will. The signal to move filtering into Postgres is
 * the server query's `limit` starting to truncate real results rather than
 * just capping a page.
 */
export function useTableControls<T>(
  items: T[],
  opts: {
    /** Row values the search box matches against. */
    searchFields?: (item: T) => (string | null | undefined)[];
    /** An ISO or YYYY-MM-DD value the from/to range filters on. */
    dateField?: (item: T) => string | null | undefined;
    /** Named comparators, one per sortable column. */
    sorters?: Record<string, (a: T, b: T) => number>;
    initialSort?: string;
    initialDir?: SortDir;
    initialPerPage?: number;
    /** Set to remember this table's controls across navigation. */
    persistKey?: string;
  },
) {
  const sorters = opts.sorters ?? {};
  const keys = Object.keys(sorters);

  // One object rather than six pieces of state: it is a single localStorage
  // entry, and one write per change instead of six.
  const [state, setState] = usePersistentState(opts.persistKey, {
    query: "",
    from: "",
    to: "",
    sortKey: opts.initialSort ?? keys[0] ?? "",
    dir: (opts.initialDir ?? "desc") as SortDir,
    page: 1,
    perPage: opts.initialPerPage ?? 20,
  });

  const { query, from, to, sortKey, dir, perPage } = state;

  // Any change to what is being shown returns to the first page. Staying on
  // page 7 while typing a search that leaves four results is a blank screen.
  const patch = (next: Partial<typeof state>, resetPage = true) =>
    setState((s) => ({ ...s, ...next, ...(resetPage ? { page: 1 } : null) }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const rows = items.filter((item) => {
      const matchesQuery =
        !q || (opts.searchFields?.(item) ?? []).some((f) => (f ?? "").toLowerCase().includes(q));

      // Comparing the first ten characters keeps this correct for both a bare
      // YYYY-MM-DD and a full ISO timestamp, without parsing either.
      const day = (opts.dateField?.(item) ?? "").slice(0, 10);
      const matchesFrom = !from || (!!day && day >= from);
      const matchesTo = !to || (!!day && day <= to);

      return matchesQuery && matchesFrom && matchesTo;
    });

    const compare = sorters[sortKey];
    if (!compare) return rows;

    const direction = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => direction * compare(a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, from, to, sortKey, dir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // Clamped rather than corrected in state: deleting the last row on page 3
  // should show page 2, not an empty table waiting for an effect to fix it.
  const page = Math.min(Math.max(1, state.page), totalPages);

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage],
  );

  return {
    rows: pageRows,
    total,
    totalPages,
    page,
    perPage,
    query,
    from,
    to,
    sortKey,
    dir,
    hasDateFilter: !!from || !!to,

    setQuery: (v: string) => patch({ query: v }),
    setFrom: (v: string) => patch({ from: v }),
    setTo: (v: string) => patch({ to: v }),
    clearDates: () => patch({ from: "", to: "" }),
    setPerPage: (n: number) => patch({ perPage: n }),
    setPage: (p: number) => patch({ page: p }, false),

    toggleSort: (key: string, defaultDir: SortDir = "asc") =>
      setState((s) =>
        s.sortKey === key
          ? { ...s, dir: s.dir === "asc" ? "desc" : "asc", page: 1 }
          : { ...s, sortKey: key, dir: defaultDir, page: 1 },
      ),
  };
}

/** Case-insensitive text comparator, locale-aware. */
export function byText<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) =>
    (get(a) ?? "").toLowerCase().localeCompare((get(b) ?? "").toLowerCase());
}

/** Numeric comparator. Null and undefined sort as zero. */
export function byNum<T>(get: (row: T) => number | null | undefined) {
  return (a: T, b: T) => (Number(get(a)) || 0) - (Number(get(b)) || 0);
}

/** Works on ISO timestamps and YYYY-MM-DD alike, both being sortable as text. */
export function byDate<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => (get(a) ?? "").localeCompare(get(b) ?? "");
}
