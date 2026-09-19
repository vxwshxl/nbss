import { cn } from "@/lib/utils";

/**
 * An endlessly scrolling band of text.
 *
 * The seam is the whole problem with a marquee, and the fix is structural: the
 * track holds the item list exactly twice and travels exactly -50%, so the
 * frame where it snaps back is pixel-identical to the frame before it. Any
 * other distance leaves a visible jump once per loop.
 *
 * Pure CSS, so it keeps running at full frame rate while GSAP is busy with the
 * pinned hero — a JS-driven marquee is the first thing to stutter on a heavy
 * scroll, and a stuttering marquee is very noticeable. `linear` for the same
 * reason any constant motion is: an eased loop pulses once per cycle.
 *
 * The duplicate half is `aria-hidden` and the whole band is presentational —
 * a screen reader gets the list once, not twice, and is not asked to sit
 * through decorative copy at all.
 */
export function Marquee({
  items,
  duration = 40,
  reverse = false,
  className,
  itemClassName,
  separator = "◆",
}: {
  items: string[];
  /** Seconds for one full pass. Longer track ⇒ longer duration, or it speeds up. */
  duration?: number;
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
  separator?: string;
}) {
  const half = (
    <ul className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className={cn("flex items-center whitespace-nowrap", itemClassName)}>
          {item}
          <span aria-hidden className="mx-6 text-primary/60">
            {separator}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={cn("marquee-root group flex overflow-hidden", className)} aria-hidden>
      <div
        className={cn("flex w-max", reverse ? "animate-marquee-reverse" : "animate-marquee")}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {half}
        {half}
      </div>
    </div>
  );
}
