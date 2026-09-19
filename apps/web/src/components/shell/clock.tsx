"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Ticks on the next half-second boundary rather than half a second after the
 * last one, so the seconds digit and the blinking colon turn over with the real
 * clock instead of drifting off it a few milliseconds per tick.
 */
function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, 500 - (Date.now() % 500));
  };
  schedule();
  return () => clearTimeout(timer);
}

/** The current half-second, as a stable integer. */
const snapshot = () => Math.floor(Date.now() / 500);

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/**
 * Date · running clock for the console topbar.
 *
 * There used to be a greeting in front of this ("Good evening", "Winding
 * down"). It read as chatter to someone using the console all day, and on a
 * narrow screen it was the widest thing in the topbar for the least reason. The
 * date and time earn their place — an office stamping receipts checks both.
 *
 * The clock is client-only by construction: rendering server time would show
 * whatever hour the Vercel region sits in and then jump to the reader's when it
 * hydrated. `useSyncExternalStore` is what makes that safe without a mount
 * flag — React renders `getServerSnapshot` (null) on the server *and* for the
 * hydrating pass, so there is nothing to mismatch, and reads the live value
 * from the first client render after that.
 */
export function Clock({ className }: { className?: string }) {
  const stamp = useSyncExternalStore(subscribe, snapshot, () => null);
  if (stamp === null) return null;

  const now = new Date(stamp * 500);
  // Split the formatted time so the two colons can be dimmed on the half-second
  // without re-running the formatter or hard-coding a "hh:mm:ss AM" layout that
  // a non-Latin locale would not produce.
  const parts = timeFmt.formatToParts(now);
  const lit = stamp % 2 === 0;

  // The seconds go before the date does. On a 320px topbar the clock is the
  // only thing between the menu button and the account group, and "01:05 AM"
  // fits where "01:05:00 AM" does not — at which point the whole element was
  // being squeezed to nothing and the time vanished rather than shortening.
  const secondary = (i: number) =>
    parts[i]?.type === "second" || parts[i + 1]?.type === "second";

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      {/* The date is the first thing to go when the topbar runs out of room —
          the time alone still answers the question someone glances up for. */}
      <span className="text-foreground/70 max-xl:hidden">{dateFmt.format(now)}</span>
      <span aria-hidden className="text-muted-foreground/40 max-xl:hidden">
        ·
      </span>
      {/* aria-hidden: a clock that announces itself twice a second is a screen
          reader talking over the page the reader is trying to use. */}
      <time aria-hidden className="text-foreground/70 tabular-nums">
        {parts.map((part, i) => (
          <span
            key={i}
            className={cn(
              secondary(i) && "max-sm:hidden",
              part.type === "literal" &&
                part.value.includes(":") &&
                cn("transition-opacity duration-300", lit ? "opacity-100" : "opacity-30"),
            )}
          >
            {part.value}
          </span>
        ))}
      </time>
    </p>
  );
}
