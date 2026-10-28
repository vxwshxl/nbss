"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowDownWideNarrow } from "lucide-react";

import { cn } from "@/lib/utils";

export type UsageRow = { key: string; label: string; sub?: string | null; n: number };

/**
 * A ranked list for Maps usage: each row's share of the total as a bar, sortable by
 * count (the default) or by name.
 */
export function UsageTable({ title, rows, empty }: { title: string; rows: UsageRow[]; empty: string }) {
  const [by, setBy] = useState<"count" | "name">("count");
  const total = rows.reduce((t, r) => t + r.n, 0);
  const top = Math.max(1, ...rows.map((r) => r.n));
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (by === "count" ? b.n - a.n || a.label.localeCompare(b.label) : a.label.localeCompare(b.label))),
    [rows, by],
  );

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-app-line bg-card shadow-e1">
      <div className="flex items-center justify-between gap-3 border-b border-app-line-soft px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex rounded-full bg-muted/70 p-0.5 ring-1 ring-border/60">
          {(
            [
              { key: "count", label: "Most", icon: ArrowDownWideNarrow },
              { key: "name", label: "A–Z", icon: ArrowDownAZ },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setBy(o.key)}
              aria-pressed={by === o.key}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                by === o.key ? "bg-background shadow-sm ring-1 ring-border" : "text-muted-foreground",
              )}
            >
              <o.icon className="size-3.5" /> {o.label}
            </button>
          ))}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-app-line-soft overflow-y-auto">
          {sorted.map((r) => (
            <li key={r.key} className="px-5 py-2.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{r.label}</span>
                  {r.sub && <span className="ml-2 font-mono text-xs text-muted-foreground">{r.sub}</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{r.n.toLocaleString("en-IN")}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{total ? Math.round((r.n / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.n / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
