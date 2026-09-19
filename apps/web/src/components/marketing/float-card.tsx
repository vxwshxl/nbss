import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The small "something just happened" cards that orbit the hero device.
 *
 * They are the one place on the page that claims to be live product output, so
 * they are built to read as chrome rather than as content: `aria-hidden`,
 * no links, and the same card/border tokens as everything else so they sit in
 * the page rather than on top of it.
 */
export function FloatCard({
  icon: Icon,
  title,
  detail,
  className,
  compactOnPhone = false,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  className?: string;
  /** Tighter padding and type below `sm`, for cards pinned around a phone-width frame. */
  compactOnPhone?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-[var(--panel-shadow)] backdrop-blur-xl",
        compactOnPhone && "max-sm:gap-2 max-sm:rounded-xl max-sm:px-3 max-sm:py-2",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary",
          compactOnPhone && "max-sm:size-7 max-sm:rounded-lg",
        )}
      >
        <Icon className={cn("size-4.5", compactOnPhone && "max-sm:size-3.5")} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold whitespace-nowrap", compactOnPhone && "max-sm:text-xs")}>
          {title}
        </span>
        <span
          className={cn(
            "block text-xs whitespace-nowrap text-muted-foreground",
            compactOnPhone && "max-sm:text-[0.6875rem]",
          )}
        >
          {detail}
        </span>
      </span>
    </div>
  );
}
