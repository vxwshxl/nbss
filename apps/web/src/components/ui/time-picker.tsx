"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dropdown } from "@/components/ui/dropdown";
import { formatTime12 } from "@/lib/format";
import { cn } from "@/lib/utils";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Parse a "HH:MM" 24h string into 12-hour parts.
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

const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5),
  label: pad(i * 5),
}));
const PERIODS = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

/**
 * App-wide time picker: a custom popover (hour / minute / AM–PM) that emits a
 * "HH:MM" 24-hour value and shows it 12-hour, matching <DatePicker>.
 */
export function TimePicker({
  value = "",
  onChange,
  placeholder = "Pick a time",
  disabled,
  id,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Popover editing state defaults to 9:00 AM when nothing is set yet.
  const p = value ? parse(value) : { hour: 9, minute: 0, pm: false };

  function emit(next: { hour?: number; minute?: number; pm?: boolean }) {
    onChange?.(
      compose(next.hour ?? p.hour, next.minute ?? p.minute, next.pm ?? p.pm),
    );
  }

  return (
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
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn(!value && "text-muted-foreground")}>
            {value ? formatTime12(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="flex items-center gap-1.5">
          <Dropdown
            options={HOURS}
            value={String(p.hour)}
            onValueChange={(v) => emit({ hour: Number(v) })}
            className="h-8 w-16"
          />
          <span className="text-muted-foreground">:</span>
          <Dropdown
            options={MINUTES}
            value={String(p.minute - (p.minute % 5))}
            onValueChange={(v) => emit({ minute: Number(v) })}
            className="h-8 w-16"
          />
          <Dropdown
            options={PERIODS}
            value={p.pm ? "PM" : "AM"}
            onValueChange={(v) => emit({ pm: v === "PM" })}
            className="h-8 w-[4.25rem]"
          />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
          <button
            type="button"
            onClick={() => {
              onChange?.("");
              setOpen(false);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-medium hover:underline"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
