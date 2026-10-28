"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type BuildPhone = { name: string; phone: string | null; device: string; seen: string };
export type BuildGroup = { key: string; label: string; build: number | null; version: string | null; people: BuildPhone[] };

/**
 * Guards' phones by the app build they run: a card per build (newest first), and the
 * people on the one picked, searchable. A card is amber when that build is asked to update.
 */
export function PhonesByBuild({ groups, required }: { groups: BuildGroup[]; required: number }) {
  const [picked, setPicked] = useState(groups[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const group = groups.find((g) => g.key === picked) ?? groups[0] ?? null;
  const behind = (g: BuildGroup) => required > 0 && (g.build == null || g.build < required);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = group?.people ?? [];
    return q ? list.filter((p) => `${p.name} ${p.phone ?? ""} ${p.device}`.toLowerCase().includes(q)) : list;
  }, [group, query]);

  if (!group) return <p className="text-sm text-muted-foreground">No phones have reported in the last 30 days.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {groups.map((g) => {
          const on = g.key === group.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setPicked(g.key)}
              aria-pressed={on}
              className={cn(
                "press min-w-[150px] rounded-2xl border px-4 py-3 text-left transition-colors",
                on ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-app-line bg-card hover:bg-muted/50",
              )}
            >
              <span className="flex items-baseline justify-between gap-4">
                <span className="text-base font-bold">{g.label}</span>
                <span className="text-2xl font-extrabold tabular-nums">{g.people.length}</span>
              </span>
              <span className={cn("block text-xs", behind(g) ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                {g.version ? `v${g.version}` : "No version reported"}
                {required > 0 ? (behind(g) ? " · must update" : " · up to date") : ""}
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex h-10 items-center gap-2 rounded-full bg-muted/70 px-3.5 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-ring/50 sm:max-w-sm">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${group.label.toLowerCase()} by name, mobile or phone`}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-app-line-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Mobile</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Phone</th>
              <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Last opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-line-soft">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Nobody matches.
                </td>
              </tr>
            )}
            {rows.map((p, i) => (
              <tr key={`${p.name}-${i}`}>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5">
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="font-mono text-primary hover:underline">
                      {p.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{p.device}</td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell">
                  {new Date(p.seen).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
