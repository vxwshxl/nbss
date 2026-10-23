"use client";

import * as React from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTime12 } from "@/lib/format";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Parse a "HH:MM" (or "HH:MM:SS") 24h string into 12-hour parts.
function parse(v: string): { hour: number; minute: number; pm: boolean } {
  const [h, m] = v.split(":").map(Number);
  const hour = h !== undefined && Number.isFinite(h) ? h : 9;
  const minute = m !== undefined && Number.isFinite(m) ? m : 0;
  return { hour: hour % 12 === 0 ? 12 : hour % 12, minute, pm: hour >= 12 };
}

function compose(hour12: number, minute: number, pm: boolean): string {
  const h24 = pm ? (hour12 % 12) + 12 : hour12 % 12;
  return `${pad(h24)}:${pad(minute)}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * App-wide time picker: a popover with AM/PM, an hour grid and a minute grid,
 * one tap each, that emits a "HH:MM" 24-hour value and shows it 12-hour,
 * matching <DatePicker>. Controlled (value + onChange) or uncontrolled
 * (defaultValue); with `name` it submits through a hidden input.
 */
export function TimePicker({
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Pick a time",
  disabled,
  id,
  className,
  step = 5,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Minutes between the offered minute marks (default 5). */
  step?: 5 | 10 | 15 | 30;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = (isControlled ? value : internal) ?? "";
  const [open, setOpen] = React.useState(false);
  // Editing starts from 9:00 AM when nothing is set yet.
  const p = current ? parse(current) : { hour: 9, minute: 0, pm: false };
  const minutes = Array.from({ length: 60 / step }, (_, i) => i * step);
  const shownMinute = p.minute - (p.minute % step);

  function set(next: string) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function emit(next: { hour?: number; minute?: number; pm?: boolean }) {
    set(compose(next.hour ?? p.hour, next.minute ?? p.minute, next.pm ?? p.pm));
  }

  const cell = (on: boolean) =>
    cn(
      "flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      on ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted",
    );

  return (
    <>
      {name && <input type="hidden" name={name} value={current ? current.slice(0, 5) : ""} />}
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
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn("min-w-0 flex-1 truncate tabular-nums", !current && "text-muted-foreground")}>
              {current ? formatTime12(current) : placeholder}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[17rem] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-lg font-semibold tabular-nums">
              {p.hour}:{pad(p.minute)} <span className="text-sm text-muted-foreground">{p.pm ? "PM" : "AM"}</span>
            </p>
            <div className="flex rounded-full bg-muted p-0.5" role="group" aria-label="AM or PM">
              {(["AM", "PM"] as const).map((x) => {
                const on = (x === "PM") === p.pm;
                return (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={on}
                    onClick={() => emit({ pm: x === "PM" })}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      on ? "bg-elevated text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {x}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Hour</p>
          <div className="grid grid-cols-6 gap-1">
            {HOURS.map((h) => (
              <button key={h} type="button" onClick={() => emit({ hour: h })} className={cell(h === p.hour)}>
                {h}
              </button>
            ))}
          </div>
          <p className="mt-3 mb-1 text-[11px] font-medium text-muted-foreground">Minute</p>
          <div className={cn("grid gap-1", minutes.length > 6 ? "grid-cols-6" : "grid-cols-4")}>
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => emit({ minute: m })}
                className={cell(m === shownMinute)}
              >
                {pad(m)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                set("");
                setOpen(false);
              }}
              className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                if (!current) emit({});
                setOpen(false);
              }}
              className="rounded-md px-1.5 py-1 font-semibold text-primary hover:underline"
            >
              Done
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
