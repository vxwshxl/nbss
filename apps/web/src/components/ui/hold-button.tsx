"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Press-and-hold to confirm. For actions that are instant, irreversible and
 * genuinely destructive, where a dialog asking "are you sure?" is answered on
 * reflex anyway.
 *
 * The fill is a `clip-path: inset()` on a solid overlay, revealed left to right.
 * Deliberately asymmetric: filling takes the full duration on `linear` because
 * the user is deciding and wants to watch real progress, while releasing snaps
 * back in 200ms on ease-out because that is the system responding, not
 * deliberating. An eased fill would misreport how much time is left.
 *
 * CSS drives the visual so it stays off the main thread; a timer of the same
 * duration decides when it actually fires. The fill survives reduced motion —
 * it is not decoration, it is the only signal that holding is doing anything.
 */
export function HoldButton({
  onHold,
  duration = 1500,
  className,
  children,
  disabled,
  hint = "Hold to confirm",
  ...props
}: Omit<React.ComponentProps<"button">, "onClick"> & {
  onHold: () => void;
  /** How long the hold must last, in ms. Matches the fill animation. */
  duration?: number;
  hint?: string;
}) {
  const [holding, setHolding] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = React.useRef<number | null>(null);

  const cancel = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pointer.current = null;
    setHolding(false);
  }, []);

  React.useEffect(() => cancel, [cancel]);

  function start(e: React.PointerEvent<HTMLButtonElement>) {
    // Ignore extra touch points once a hold is under way — without this, a
    // second finger restarts the timer and the first one appears to do nothing.
    if (disabled || holding || pointer.current !== null || e.button > 0) return;
    pointer.current = e.pointerId;
    // Capture so the hold survives the finger sliding off the button; releasing
    // outside then still cancels, which is what a user expects from a drag-away.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
    timer.current = setTimeout(() => {
      cancel();
      onHold();
    }, duration);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      data-holding={holding || undefined}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      // A hold is a poor fit for keyboard and switch access, so Enter/Space
      // confirm outright: getting here already took a deliberate focus + press.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onHold();
        }
      }}
      title={hint}
      className={cn(
        "group/hold relative isolate inline-flex h-8 shrink-0 items-center justify-center gap-1.5 overflow-hidden",
        "rounded-lg px-2.5 text-sm font-medium whitespace-nowrap select-none",
        "bg-destructive/10 text-destructive outline-none",
        "transition-[scale] duration-150 ease-out-strong active:scale-(--press-scale)",
        "focus-visible:ring-3 focus-visible:ring-destructive/30",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      style={{ ["--hold-duration" as string]: `${duration}ms` }}
      {...props}
    >
      {/* The fill. Sits behind the label but above the tinted base, so the label
          reads against both halves as the edge crosses it. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-destructive",
          "[clip-path:inset(0_100%_0_0)] [transition:clip-path_200ms_var(--ease-out-strong)]",
          "group-data-[holding]/hold:[clip-path:inset(0_0_0_0)]",
          "group-data-[holding]/hold:[transition:clip-path_var(--hold-duration)_linear]",
        )}
      />
      <span className="relative inline-flex items-center gap-1.5 transition-colors duration-150 group-data-[holding]/hold:text-destructive-foreground">
        {children}
      </span>
    </button>
  );
}
