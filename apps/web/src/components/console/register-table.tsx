"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import type { SheetRow } from "@/components/console/attendance-views";
import { RegisterExport } from "@/components/console/register-export";

/**
 * The month register in the console's table frame: the dark band of the check-in log
 * (count, a search box, Print and Excel) running into the grid's dark column header.
 *
 * The grid itself stays server-rendered (`children`, a MonthGrid with `head="ink"`);
 * searching hides its rows by `data-guard` and narrows what Print and Excel export
 * to the same people.
 */
export function RegisterTable({
  sheet,
  days,
  exportTitle,
  noun = "people",
  children,
}: {
  sheet: SheetRow[];
  days: string[];
  exportTitle: string;
  noun?: string;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return sheet;
    return sheet.filter((r) => {
      const hay = `${r.name} ${r.code}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [sheet, query]);

  useEffect(() => {
    const ids = new Set(shown.map((r) => r.id));
    box.current?.querySelectorAll<HTMLElement>("tr[data-guard]").forEach((tr) => {
      tr.hidden = !ids.has(tr.dataset.guard ?? "");
    });
  }, [shown]);

  return (
    <div className="overflow-hidden rounded-3xl bg-elevated shadow-e1 ring-1 ring-border print:shadow-none">
      <div className="bg-ink px-5 pt-5 pb-3 text-ink-fg sm:px-6">
        <div className="grid items-center gap-3 @2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,34rem)_minmax(0,1fr)]">
          <div className="min-w-0 truncate text-[15px] font-semibold">
            {shown.length} {noun}
          </div>
          <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-full bg-white/10 px-4 text-[14px] text-ink-fg ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-white/50">
            <Search className="size-4 shrink-0 text-ink-fg/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or code…"
              className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-ink-fg/50"
            />
            <span className="shrink-0 text-[12px] text-ink-fg/60 tabular-nums">{shown.length}</span>
          </label>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <RegisterExport title={exportTitle} days={days} sheet={shown} tone="ink" />
          </div>
        </div>
      </div>
      <div ref={box}>{children}</div>
      {sheet.length > 0 && shown.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nobody matches &ldquo;{query.trim()}&rdquo;.</p>
      )}
    </div>
  );
}
