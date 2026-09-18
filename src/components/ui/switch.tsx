"use client";

import { cn } from "@/lib/utils";

/**
 * On/off toggle. A native button with role="switch", so Space and Enter work
 * without extra wiring. The track is 24px tall; `after:` pads the hit area out
 * past 44px without changing the layout.
 */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const state = checked ? "checked" : "unchecked";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={state}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input outline-none transition-colors after:absolute after:-inset-2.5 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span
        data-state={state}
        className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform duration-150 ease-out-strong data-[state=checked]:translate-x-4 motion-reduce:transition-none"
      />
    </button>
  );
}
