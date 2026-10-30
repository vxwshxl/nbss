"use client";

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";

import { VIEWS_EVENT } from "@/components/page-tracker";
import { cn } from "@/lib/utils";

/**
 * The footer's page-view counter, in the brand's gold: every real visit to every page
 * (migration 0071). It updates when this visit is counted (VIEWS_EVENT from PageTracker),
 * and reads the count once on mount.
 */
export function VisitorCount({ className }: { className?: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const on = (e: Event) => setN((cur) => Math.max(cur ?? 0, Number((e as CustomEvent<number>).detail) || 0));
    addEventListener(VIEWS_EVENT, on);
    fetch("/api/track")
      .then((r) => r.json())
      .then((d: { views?: number }) => setN((cur) => Math.max(cur ?? 0, Number(d.views) || 0)))
      .catch(() => {});
    return () => removeEventListener(VIEWS_EVENT, on);
  }, []);
  return (
    <p className={cn("inline-flex h-11 items-center gap-2 rounded-full bg-gold/15 px-5 text-[14px] text-gold-soft ring-1 ring-gold/40", className)} aria-live="polite">
      <Eye className="size-4" aria-hidden />
      <span className="text-[16px] font-semibold tabular-nums text-gold">{n === null ? "·" : n.toLocaleString("en-IN")}</span>
      <span>{n === 1 ? "page view" : "page views"}</span>
    </p>
  );
}
