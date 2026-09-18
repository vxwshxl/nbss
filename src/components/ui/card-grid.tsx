"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SearchX,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CardGridItem = {
  /** Stable key for the card. */
  key: string;
  /** Text this card contributes to the search box. */
  search: string;
  /** Pre-rendered card content. */
  node: React.ReactNode;
};

/**
 * Searchable, paginated grid of pre-rendered cards. Cards are built upstream
 * (server or client) and passed in as nodes so this stays presentation-only.
 */
export function CardGrid({
  items,
  pageSize = 6,
  searchPlaceholder = "Search…",
  toolbar,
  emptyMessage = "Nothing here yet.",
  gridClassName = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  items: CardGridItem[];
  pageSize?: number;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  gridClassName?: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.search.toLowerCase().includes(q));
  }, [items, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
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
        {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-app-line-soft bg-card shadow-card px-6 py-16 text-center">
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
            <p className="max-w-sm text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      ) : (
        // `key` on the grid restarts the cascade when the page or query changes,
        // so a new set of cards animates in rather than snapping into place.
        <div key={`${current}-${query}`} className={cn("stagger", gridClassName)}>
          {visible.map((it) => (
            <Fragment key={it.key}>{it.node}</Fragment>
          ))}
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="flex items-center justify-end gap-4 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {current * pageSize + 1}&ndash;
            {Math.min(filtered.length, current * pageSize + pageSize)} of{" "}
            {filtered.length}
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
      )}
    </div>
  );
}
