"use client";

import { useState } from "react";

import { COUNTRY_CODES, joinPhone, splitPhone } from "@nbss/shared/identity";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * A phone number as the office needs it: the country code from a list (+91 preset) and
 * exactly ten digits, nothing else accepted while typing. The form receives one value
 * under `name`: ten digits for India, "+<code><ten digits>" for anywhere else.
 */
export function PhoneInput({
  name,
  id,
  defaultValue,
  required,
  onValueChange,
  className,
  invalid,
}: {
  name?: string;
  id?: string;
  defaultValue?: string | null;
  required?: boolean;
  /** Called with the joined value on every change (for controlled forms). */
  onValueChange?: (value: string) => void;
  className?: string;
  invalid?: boolean;
}) {
  const start = splitPhone(defaultValue);
  const [code, setCode] = useState(start.code);
  const [national, setNational] = useState(start.national.slice(0, 10));
  const joined = national ? joinPhone(code, national) : "";

  const update = (c: string, n: string) => {
    setCode(c);
    setNational(n);
    onValueChange?.(n ? joinPhone(c, n) : "");
  };

  return (
    <div
      className={cn(
        "flex h-10 w-full items-center overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
        className,
      )}
    >
      <Select value={code} onValueChange={(c) => update(c, national)}>
        <SelectTrigger aria-label="Country code" className="h-full w-auto shrink-0 rounded-none border-0 border-r border-input bg-muted px-2.5 font-mono text-sm font-semibold shadow-none focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent searchPlaceholder="Search country or code">
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code} description={c.label}>
              {c.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={national}
        onChange={(e) => update(code, e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="10-digit number"
        required={required}
        pattern="\d{10}"
        title="Exactly 10 digits"
        maxLength={10}
        aria-invalid={invalid || undefined}
        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm tracking-wider outline-none"
      />
      {name && <input type="hidden" name={name} value={joined} />}
    </div>
  );
}
