"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Radix Select forbids empty-string item values, so an "unassigned" option is
// represented internally by this sentinel and mapped back to "" for forms.
const EMPTY = "__none__";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * The app-wide dropdown. A styled, custom (non-native) menu built on Radix
 * Select that still submits through regular FormData via a hidden input and
 * supports an empty/"unassigned" option. Works controlled (value+onValueChange)
 * or uncontrolled (defaultValue).
 */
export function Dropdown({
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  id,
  className,
}: {
  options: DropdownOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  function handle(next: string) {
    const real = next === EMPTY ? "" : next;
    if (!isControlled) setInternal(real);
    onValueChange?.(real);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Select
        value={current === "" ? EMPTY : current}
        onValueChange={handle}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={cn("w-full", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const v = o.value === "" ? EMPTY : o.value;
            return (
              <SelectItem key={v} value={v} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </>
  );
}
