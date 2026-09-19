"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { NavIndexItem } from "./nav-index";

/**
 * Jump-to-anything for the console.
 *
 * The school console has fifty-odd destinations across a dozen groups. Once a
 * sidebar is longer than a screen it stops being navigation and becomes a
 * directory you scan, and the office staff who live in this app all day are the
 * ones paying for that. A palette turns "where is Caution Money" from a scroll
 * and a scan into four keystrokes.
 *
 * It is built on the nav index the breadcrumbs already use, not a second list —
 * a destination that exists in one and not the other is exactly the drift that
 * makes a palette untrustworthy, and the index is derived from the nav
 * definitions themselves.
 *
 * Deliberately no new dependency. cmdk would do this, but the whole surface is
 * a filtered list with four key handlers, and the Dialog primitive underneath
 * already solves the hard parts (focus trap, scroll lock, escape, the
 * dismissable-layer stack).
 */

/** Matches when every typed word appears in the label or its group. */
function matches(item: NavIndexItem, words: string[]): boolean {
  if (words.length === 0) return true;
  const hay = `${item.label} ${item.group ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * Rank: a label that starts with the query beats one that merely contains it,
 * and a label match always beats a match that only hit the group name. Without
 * this, typing "fee" puts "Fee Collections › Invoices" above "School Fees".
 */
function score(item: NavIndexItem, query: string): number {
  const label = item.label.toLowerCase();
  if (!query) return 0;
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.includes(query)) return 2;
  return 3;
}

export function CommandPalette({ index }: { index: NavIndexItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return index
      .filter((i) => matches(i, words))
      .sort((a, b) => score(a, q) - score(b, q))
      .slice(0, 40);
  }, [index, query]);

  // ⌘K / Ctrl+K from anywhere, and "/" when the caret is not already in a
  // field — the second is what people who grew up on Gmail reach for, and it
  // costs nothing to honour.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQuery("");
            setActive(0);
          }
          return !v;
        });
        return;
      }
      if (k !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      setQuery("");
      setActive(0);
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // `active` is only ever moved by the user now, but a filter that shrinks the
  // list could leave the index past the end for one render; clamping at read
  // time makes that impossible without another piece of state to keep in step.
  const activeIdx = results.length ? Math.min(active, results.length - 1) : 0;

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  /**
   * Opening resets the query and the highlight. Done where the change
   * originates rather than in an effect watching `open`: this component owns
   * both pieces of state, so reacting to its own update is a render it does not
   * need to do.
   */
  const setOpenReset = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(0);
    }
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) go(hit.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenReset(true)}
        // 44px tall on touch, where it is icon-only; the label and the hint
        // appear once there is room for them.
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 rounded-xl border border-app-line-soft bg-card px-2.5 text-sm text-muted-foreground transition-colors sm:h-9 sm:px-3",
          "hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        )}
        aria-label="Search the console"
      >
        <Search className="size-4 shrink-0" strokeWidth={2} />
        <span className="hidden lg:inline">Search…</span>
        <kbd className="hidden rounded border border-app-line-soft bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium xl:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpenReset}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Search the console</DialogTitle>
          <DialogDescription className="sr-only">
            Type to filter every page you have access to, then press Enter.
          </DialogDescription>

          <div className="flex items-center gap-2.5 border-b border-app-line-soft px-4">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              strokeWidth={2}
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Go to…"
              aria-label="Search the console"
              role="combobox"
              aria-expanded
              aria-controls="command-palette-results"
              aria-activedescendant={
                results[activeIdx] ? `cp-opt-${activeIdx}` : undefined
              }
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul
            ref={listRef}
            id="command-palette-results"
            role="listbox"
            aria-label="Results"
            className="max-h-[min(24rem,55vh)] overflow-y-auto p-1.5"
          >
            {results.map((r, i) => (
              <li key={r.href} role="presentation">
                <button
                  type="button"
                  id={`cp-opt-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    i === activeIdx ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {r.label}
                  </span>
                  {r.group && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {r.group}
                    </span>
                  )}
                  {i === activeIdx && (
                    <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}

            {results.length === 0 && (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </li>
            )}
          </ul>

          <div className="flex items-center gap-4 border-t border-app-line-soft px-4 py-2.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-app-line-soft bg-muted px-1 py-0.5 font-sans">
                ↑
              </kbd>
              <kbd className="rounded border border-app-line-soft bg-muted px-1 py-0.5 font-sans">
                ↓
              </kbd>
              to move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-app-line-soft bg-muted px-1 py-0.5 font-sans">
                ↵
              </kbd>
              to open
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <kbd className="rounded border border-app-line-soft bg-muted px-1 py-0.5 font-sans">
                esc
              </kbd>
              to close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
