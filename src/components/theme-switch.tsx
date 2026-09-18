"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Monitor, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";

// Ordered light → system → dark so the track reads as a spectrum rather than an
// arbitrary list, and the knob's direction of travel means something.
const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const subscribeNever = () => () => {};

/**
 * Icon-only theme switch: three segments with a knob that slides to the active
 * one. Defaults to System.
 *
 * The knob is positioned with `translate: calc(index * 100%)` rather than by
 * measuring the DOM — the segments are equal width, so its own width is exactly
 * one step. That keeps it on the compositor with no layout reads, no resize
 * listener, and nothing to re-measure when the font loads.
 *
 * `theme` is read (not `resolvedTheme`) so System stays selected while the OS is
 * in dark mode — the control shows the user's choice, not its outcome.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  // "Has this hydrated yet?" — false through SSR and the hydration render, true
  // afterwards. useSyncExternalStore is the way to ask that without a
  // setState-in-effect, which React flags as a cascading render.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  // Gated on `mounted`, not just hidden behind opacity: next-themes has already
  // read localStorage by the first client render, so deriving the position from
  // `theme` here would disagree with the server's markup and trip a hydration
  // mismatch. Until mounted both sides render the same neutral position.
  const index = mounted
    ? Math.max(0, MODES.findIndex((m) => m.value === (theme ?? "system")))
    : 1;

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "relative inline-flex items-center rounded-full bg-muted/70 p-0.5 ring-1 ring-border/60",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0.5 left-0.5 size-8 rounded-full bg-background shadow-sm ring-1 ring-border",
          "transition-[translate,opacity] duration-200 ease-out-strong motion-reduce:transition-none",
        )}
        style={{
          translate: `calc(${index} * 100%) 0`,
          opacity: mounted ? 1 : 0,
        }}
      />
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = mounted && value === (theme ?? "system");
        return (
          <Hint key={value} label={label}>
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              // `after` stretches the hit area to 44px tall without changing the
              // 32px the control actually occupies in a dense top bar.
              "relative z-10 inline-flex size-8 items-center justify-center rounded-full outline-none",
              "after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']",
              "transition-[color,scale] duration-150 ease-out-strong active:scale-(--press-scale)",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </button>
          </Hint>
        );
      })}
    </div>
  );
}
