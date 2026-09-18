import Image from "next/image";

import { cn } from "@/lib/utils";
import { site } from "@/content/site";

/**
 * The company mark.
 *
 * A real photograph-quality raster rather than an inline SVG, because the mark
 * NBSS actually uses is a painted shield and redrawing it as paths would make
 * it a different mark. `unoptimized` keeps it out of the image pipeline: it is
 * already a 6 KB webp at the only three sizes anything asks for, and running it
 * through a resizer on every cold start buys nothing.
 *
 * `priority` is offered rather than assumed. The mark is the LCP candidate on
 * the auth screens and in the sidebar of a cold console load, and nowhere else
 * — preloading it on all twenty marketing pages would just push the hero photo
 * down the queue.
 */
export function Mark({
  size = 36,
  priority = false,
  className,
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/logo/nbss-256.webp"
      alt=""
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={cn("shrink-0 rounded-md object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Mark plus wordmark, as it appears in the sidebar and the marketing header.
 *
 * The second line is a slot rather than a fixed string: in the console it names
 * the signed-in person's role ("Supervisor"), and on the public site it carries
 * the tagline. Those are the same typographic object doing two jobs, and making
 * it a prop is what stops a second near-identical component being written for
 * the other one.
 */
export function Wordmark({
  secondary,
  size = 36,
  priority = false,
  className,
}: {
  secondary?: React.ReactNode;
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Mark size={size} priority={priority} />
      {/* `data-rail-hide` is read by the app shell: on the collapsed icon rail
          the words go and the mark stays. Harmless everywhere else. */}
      <span data-rail-hide className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-display text-sm font-bold tracking-tight">
          {site.shortName}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {secondary ?? site.tagline}
        </span>
      </span>
    </span>
  );
}

/**
 * The woven Aronai border — the narrow Bodo scarf given to honour a guest.
 *
 * Used as the structural rule between major regions of a page rather than as
 * ornament laid on top of one. It inherits `currentColor` through a mask (see
 * `.aronai` in globals.css), so the same element works on the hero's near-black
 * and on a white section without a second asset.
 */
export function AronaiBand({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      aria-hidden
      className={cn("aronai w-full text-primary/25", className)}
    />
  );
}
