"use client";

import * as React from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

/** Split a datetime-local string ("YYYY-MM-DDTHH:MM") into date + time parts. */
function split(v: string | undefined): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  const [date = "", rest = ""] = v.split("T");
  return { date, time: rest.slice(0, 5) };
}

/**
 * App-wide date + time picker: composes the custom <DatePicker> and <TimePicker>
 * and submits a single datetime-local value ("YYYY-MM-DDTHH:MM") via a hidden
 * input, so it's a drop-in replacement for `<input type="datetime-local">` in
 * forms. Time defaults to 00:00 once a date is chosen.
 */
export function DateTimePicker({
  name,
  defaultValue,
  value,
  onChange,
  id,
  disabled,
  className,
  minYear,
  maxYear,
  datePlaceholder = "Pick a date",
  timePlaceholder = "Time",
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  minYear?: number;
  maxYear?: number;
  datePlaceholder?: string;
  timePlaceholder?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(() => split(defaultValue));
  const parts = isControlled ? split(value) : internal;

  // Combined datetime-local value; empty until a date is picked.
  const combined = parts.date ? `${parts.date}T${parts.time || "00:00"}` : "";

  function update(next: { date?: string; time?: string }) {
    const merged = { date: next.date ?? parts.date, time: next.time ?? parts.time };
    if (!isControlled) setInternal(merged);
    onChange?.(merged.date ? `${merged.date}T${merged.time || "00:00"}` : "");
  }

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {name && <input type="hidden" name={name} value={combined} />}
      <DatePicker
        id={id}
        value={parts.date}
        onChange={(date) => update({ date })}
        disabled={disabled}
        placeholder={datePlaceholder}
        minYear={minYear}
        maxYear={maxYear}
      />
      <TimePicker
        value={parts.time}
        onChange={(time) => update({ time })}
        disabled={disabled}
        placeholder={timePlaceholder}
      />
    </div>
  );
}
