"use client";

import { Coffee, Plus, X } from "lucide-react";

import { TimePicker } from "@/components/ui/time-picker";
import { checkBreaks, hoursLabel, type Break } from "@/lib/roster";

const toTime = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Times off inside a post's hours: 8 am – 8 pm with a break 12 – 1 is two duties,
 * 8 – 12 and 1 – 8, each checked in to and checked out of automatically on its own.
 * Shows the parts of the day as they will be rostered, or why the breaks do not fit.
 */
export function BreaksEditor({
  starts,
  ends,
  breaks,
  onChange,
}: {
  starts: string;
  ends: string;
  breaks: Break[];
  onChange: (breaks: Break[]) => void;
}) {
  const checked = starts && ends ? checkBreaks(starts, ends, breaks) : null;

  function add() {
    // An hour, after the last break (or halfway through the shift), kept inside the hours.
    const len = (minutes(ends) - minutes(starts) + 1440) % 1440 || 1440;
    const lastEnd = breaks.length ? (minutes(breaks.at(-1)!.ends) - minutes(starts) + 1440) % 1440 : 0;
    const from = Math.min(Math.max(lastEnd + 60, Math.floor(len / 2 / 30) * 30), len - 90);
    onChange([...breaks, { starts: toTime(minutes(starts) + Math.max(30, from)), ends: toTime(minutes(starts) + Math.max(30, from) + 60) }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {breaks.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <Coffee className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">Break</span>
          <TimePicker
            value={b.starts}
            onChange={(v) => onChange(breaks.map((x, k) => (k === i ? { ...x, starts: v } : x)))}
            placeholder="From"
            className="h-9 min-w-0 flex-1 bg-card"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <TimePicker
            value={b.ends}
            onChange={(v) => onChange(breaks.map((x, k) => (k === i ? { ...x, ends: v } : x)))}
            placeholder="To"
            className="h-9 min-w-0 flex-1 bg-card"
          />
          <button
            type="button"
            aria-label="Remove this break"
            onClick={() => onChange(breaks.filter((_, k) => k !== i))}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {breaks.length < 6 && starts && ends && (
          <button
            type="button"
            onClick={add}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary-ink ring-1 ring-primary/30 hover:bg-primary/5"
          >
            <Plus className="size-3.5" /> Add a break
          </button>
        )}
        {checked && !checked.ok ? (
          <span className="text-xs font-medium text-destructive">{checked.error}</span>
        ) : breaks.length > 0 && starts && ends ? (
          <span className="text-xs text-muted-foreground">
            On duty {hoursLabel(`${starts}:00`, `${ends}:00`, breaks)}. Each part is checked out of automatically at its end.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Off for part of the shift? Add a break, as many as needed.</span>
        )}
      </div>
    </div>
  );
}

/** Whether a set of breaks can be saved with these hours. */
export function breaksFit(starts: string, ends: string, breaks: Break[]): boolean {
  return !starts || !ends || checkBreaks(starts, ends, breaks).ok;
}
