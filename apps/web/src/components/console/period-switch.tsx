"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, type LucideIcon } from "lucide-react";

import { convertAt, currentAt, periodTitle, stepPeriod, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

/**
 * Daily, Monthly or Yearly, then earlier and later: the one period control every log in
 * the console uses. It writes `?period=…&at=…` and keeps the page's other parameters.
 * `children` sits at the end of the bar (a site filter, say).
 */
export function PeriodSwitch({
  period,
  at,
  today,
  children,
  className,
}: {
  period: Period;
  at: string;
  today: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const go = (p: Period, a: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("period", p);
    q.set("at", a);
    start(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  };
  const current = currentAt(period, today);
  const next = stepPeriod(period, at, 1);

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border border-app-line bg-card p-2.5 shadow-e1 md:flex-row md:items-center", className)}>
      <div role="radiogroup" aria-label="Period" className="grid grid-cols-3 rounded-full bg-muted/70 p-1 ring-1 ring-border/60 md:inline-grid">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={period === p.key}
            onClick={() => period !== p.key && go(p.key, convertAt(p.key, at, today))}
            className={cn(
              "press rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              period === p.key ? "bg-[#009164] text-white shadow-[0_2px_0_#006b4a]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <button type="button" onClick={() => go(period, stepPeriod(period, at, -1))} aria-label="Earlier" className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-border hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        <p className="flex min-w-0 flex-1 items-center justify-center gap-2 truncate text-center text-sm font-semibold md:flex-none md:min-w-64">
          {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-emerald-700" /> : <CalendarDays className="size-4 shrink-0 text-emerald-700" />}
          <span className="truncate">{periodTitle(period, at, today)}</span>
        </p>
        <button
          type="button"
          onClick={() => go(period, next)}
          disabled={next > current}
          aria-label="Later"
          className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-border hover:bg-muted disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
        {at !== current && (
          <button type="button" onClick={() => go(period, current)} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-muted">
            {period === "day" ? "Today" : period === "month" ? "This month" : "This year"}
          </button>
        )}
      </div>

      {children ? <div className="flex flex-wrap items-center gap-2 md:ml-auto">{children}</div> : null}
    </div>
  );
}

/** A count for the period, in the strip under the switch. */
export function PeriodCount({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-app-line bg-card p-3.5 shadow-e1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value.toLocaleString("en-IN")}</p>
    </div>
  );
}
