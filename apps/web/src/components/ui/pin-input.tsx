"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

const LENGTH = 4;

/**
 * The 4-digit PIN as an OTP box row: four cells that fill as the digits go in.
 *
 * One real input sits invisibly over the cells, so the keypad, paste, backspace and a
 * password manager's fill all behave as they do on any input; the cells only draw what
 * it holds. Digits only, never more than four. `onComplete` fires on the fourth digit,
 * which the sign-in uses to submit without a tap.
 */
export function PinInput({
  id,
  name,
  autoComplete = "current-password",
  autoFocus,
  required,
  onComplete,
  className,
}: {
  id?: string;
  name: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  onComplete?: (pin: string, input: HTMLInputElement) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex flex-1 gap-2.5">
        {Array.from({ length: LENGTH }, (_, i) => {
          const digit = value[i];
          const active = focused && (i === value.length || (i === LENGTH - 1 && value.length === LENGTH));
          return (
            <div
              key={i}
              aria-hidden
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-xl border border-input bg-background font-mono text-xl font-semibold transition-colors",
                active && "border-ring ring-3 ring-ring/50",
              )}
            >
              {digit ? (shown ? digit : <span className="size-2.5 rounded-full bg-foreground" />) : null}
            </div>
          );
        })}
        <input
          ref={ref}
          id={id}
          name={name}
          type="password"
          inputMode="numeric"
          pattern={`\\d{${LENGTH}}`}
          maxLength={LENGTH}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required={required}
          aria-label="4-digit PIN"
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, LENGTH);
            setValue(next);
            if (next.length === LENGTH && ref.current) onComplete?.(next, ref.current);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide PIN" : "Show PIN"}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
