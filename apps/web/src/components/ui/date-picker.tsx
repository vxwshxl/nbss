"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dropdown } from "@/components/ui/dropdown";
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
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = isControlled ? value : internal;
  const [open, setOpen] = React.useState(false);

  const today = new Date();
  const initial = current ? current.split("-").map(Number) : null;
  const [viewYear, setViewYear] = React.useState(initial?.[0] ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial?.[1] ?? today.getMonth() + 1);

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
  const topYear = maxYear ?? today.getFullYear() + 10;
  const years = Array.from(
    { length: Math.max(1, topYear - minYear + 1) },
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
              "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
              className,
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn(!current && "text-muted-foreground")}>
              {current ? toDisplay(current) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
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
              if (day === null) return <div key={i} className="size-8" />;
              const dateStr = `${viewYear}-${pad(viewMonth)}-${pad(day)}`;
              const isSelected = dateStr === current;
              const isToday =
                today.getFullYear() === viewYear &&
                today.getMonth() + 1 === viewMonth &&
                today.getDate() === day;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(day)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
                    isSelected
                      ? "bg-foreground font-semibold text-background"
                      : "hover:bg-accent",
                    !isSelected && isToday && "ring-1 ring-border",
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
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const t = new Date();
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth() + 1);
                set(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`);
                setOpen(false);
              }}
              className="font-medium hover:underline"
            >
              Today
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
