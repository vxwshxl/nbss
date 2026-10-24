"use client";

import { ArrowRight, CalendarRange } from "lucide-react";

import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

const iso = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Quick periods, from today in IST. */
function quick(): { label: string; from: string; to: string }[] {
  const today = new Date();
  const t = iso(today);
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastMonthEnd = new Date(Date.UTC(y, m - 1, 0));
  const back = (days: number) => iso(new Date(today.getTime() - days * 86_400_000));
  return [
    { label: "This month", from: `${y}-${pad(m)}-01`, to: t },
    { label: "Last month", from: `${lastMonthEnd.getUTCFullYear()}-${pad(lastMonthEnd.getUTCMonth() + 1)}-01`, to: lastMonthEnd.toISOString().slice(0, 10) },
    { label: "Last 7 days", from: back(6), to: t },
    { label: "Last 30 days", from: back(29), to: t },
  ];
}

/**
 * The period every report reads: quick picks, then From → To, centred so it reads as one
 * control rather than a label with two boxes trailing off to the left.
 */
export function PeriodBar({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : null;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-app-line bg-gradient-to-r from-emerald-50 via-card to-sky-50 p-4 shadow-e1">
      <div className="flex flex-wrap justify-center gap-1.5">
        {quick().map((q) => {
          const on = q.from === from && q.to === to;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.from, q.to)}
              className={cn(
                "press rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                on ? "bg-[#009164] text-white shadow-[0_2px_0_#006b4a]" : "bg-card text-foreground ring-1 ring-border hover:bg-muted",
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <CalendarRange className="size-4 text-emerald-700" />
        <DatePicker value={from} max={to || undefined} onChange={(v) => v && onChange(v, to)} placeholder="From" className="h-9 w-40" />
        <ArrowRight className="size-4 text-muted-foreground" />
        <DatePicker value={to} min={from || undefined} onChange={(v) => v && onChange(from, v)} placeholder="To" className="h-9 w-40" />
        {days ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{days} day{days === 1 ? "" : "s"}</span> : null}
      </div>
    </div>
  );
}
