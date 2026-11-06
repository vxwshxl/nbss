"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { People } from "@/lib/people";
import { cn } from "@/lib/utils";

const TABS: { key: People; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "guard", label: "Guards" },
  { key: "housekeeping", label: "Housekeepers" },
];

/** Everyone, Guards or Housekeepers: the `?people=` switch on every attendance page. */
export function PeopleTabs({ value, className }: { value: People; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const go = (p: People) => {
    const q = new URLSearchParams(params.toString());
    if (p === "all") q.delete("people");
    else q.set("people", p);
    start(() => router.push(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false }));
  };
  return (
    <div role="radiogroup" aria-label="People" className={cn("inline-flex items-center gap-0.5 rounded-full bg-muted/70 p-1 ring-1 ring-border/60", className)}>
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={value === t.key}
          onClick={() => value !== t.key && go(t.key)}
          className={cn(
            "press rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
            value === t.key ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
      {pending && <Loader2 className="mx-1.5 size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
