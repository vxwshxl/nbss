"use client";

import * as React from "react";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dropdown } from "@/components/ui/dropdown";
import { istToday } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDisplay(v: string): string {
  // v is YYYY-MM-DD; format as "1 Jun 2026" without timezone drift.
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/**
 * App-wide date picker: a custom calendar in a popover that submits a
 * YYYY-MM-DD value via a hidden input (forms) and also supports controlled use.
 * `min` / `max` (YYYY-MM-DD) grey out the days outside them, as the native
 * input's attributes of the same name would.
 */
export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Pick a date",
  disabled,
  id,
  className,
  minYear = 2000,
  maxYear,
  min,
  max,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Earliest selectable year in the dropdown (default 2000). */
  minYear?: number;
  /** Latest selectable year (default current year + 10, for future events). */
  maxYear?: number;
  /** Earliest pickable day, YYYY-MM-DD. */
  min?: string;
  /** Latest pickable day, YYYY-MM-DD. */
  max?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = isControlled ? value : internal;
  const [open, setOpen] = React.useState(false);

  // "Today" is the IST calendar day, whatever zone the browser is in.
  const todayStr = istToday();
  const today = { year: Number(todayStr.slice(0, 4)), month: Number(todayStr.slice(5, 7)) };
  const outside = (d: string) => (min != null && d < min) || (max != null && d > max);
  const initial = current ? current.split("-").map(Number) : null;
  const [viewYear, setViewYear] = React.useState(initial?.[0] ?? today.year);
  const [viewMonth, setViewMonth] = React.useState(initial?.[1] ?? today.month);

  function set(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function pick(day: number) {
    set(`${viewYear}-${pad(viewMonth)}-${pad(day)}`);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setViewMonth(m);
    setViewYear(y);
  }

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const startWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Jump straight to any month/year using the app dropdown for consistency.
  const topYear = max ? Number(max.slice(0, 4)) : (maxYear ?? today.year + 10);
  const bottomYear = min ? Number(min.slice(0, 4)) : minYear;
  const years = Array.from(
    { length: Math.max(1, topYear - bottomYear + 1) },
    (_, i) => topYear - i,
  );
  const monthOptions = MONTHS_SHORT.map((m, i) => ({ value: String(i + 1), label: m }));
  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:border-ring dark:bg-input/30",
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("min-w-0 flex-1 truncate", !current && "text-muted-foreground")}>
              {current ? toDisplay(current) : placeholder}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Dropdown
                options={monthOptions}
                value={String(viewMonth)}
                onValueChange={(v) => setViewMonth(Number(v))}
                className="h-8 w-[4.75rem]"
              />
              <Dropdown
                options={yearOptions}
                value={String(viewYear)}
                onValueChange={(v) => setViewYear(Number(v))}
                className="h-8 w-[5rem]"
              />
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="size-9" />;
              const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
              const isSelected = dateStr === current;
              const isToday = dateStr === todayStr;
              const off = outside(dateStr);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={off}
                  onClick={() => pick(day)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35",
                    isSelected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "hover:bg-muted",
                    !isSelected && isToday && "font-semibold text-primary ring-1 ring-primary/40",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
            <button
              type="button"
              onClick={() => { set(""); setOpen(false); }}
              className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={outside(todayStr)}
              onClick={() => {
                setViewYear(today.year);
                setViewMonth(today.month);
                set(todayStr);
                setOpen(false);
              }}
              className="rounded-md px-1.5 py-1 font-semibold text-primary hover:underline disabled:opacity-40"
            >
              Today
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
