"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, toneFor, type Tone } from "@/lib/ui/tones";

/**
 * One row of console navigation, shared by the tenant, platform-admin and agent
 * sidebars — they had three byte-identical copies of this markup, which is how
 * a focus ring ends up on two of them.
 *
 * The icon sits in a tinted tile rather than loose in the row. With forty
 * destinations in the tenant nav, a column of same-coloured glyphs is a wall of
 * grey you have to read word by word; the tint is what lets someone find Fees
 * again by shape and colour rather than by re-reading the list. The tone is
 * derived from the href, so a destination keeps its colour for the life of the
 * app and across every role that can see it.
 */
export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  tone,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  tone?: Tone;
  /** Pending/unseen count. Becomes a dot when the sidebar is a rail. */
  badge?: number;
}) {
  const t = TONES[tone ?? toneFor(href)];
  return (
    <Link
      href={href}
      data-active={active || undefined}
      data-rail-compact
      // The label is the tooltip only on the rail, where it is the sole thing
      // identifying the row; leaving it on at full width would put a native
      // tooltip over text that is already legible.
      title={label}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg p-2 text-sm font-medium outline-none transition-colors duration-100 lg:p-1.5",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
        "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        // The hover pair is repeated for the active row on purpose: `hover:` is
        // emitted after `data-active:`, so without `data-active:hover:text-…`
        // hovering the filled ink pill turned its label ink too — invisible.
        "data-active:bg-sidebar-primary data-active:font-semibold data-active:text-sidebar-primary-foreground data-active:hover:bg-sidebar-primary data-active:hover:text-sidebar-primary-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
          // On the filled row the tile drops its own tint and borrows the
          // fill's foreground: a pastel square inside a solid ink pill reads as
          // a sticker, not as the same control in a different state.
          active ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground" : t.chip,
        )}
      >
        <Icon className="size-4" strokeWidth={1.9} />
      </span>
      <span data-rail-hide className="min-w-0 flex-1 truncate">
        {label}
      </span>
      {typeof badge === "number" && badge > 0 && (
        <span
          data-rail-dot
          title={`${badge} pending`}
          className={cn(
            "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
            active
              ? "bg-sidebar-primary-foreground text-sidebar-primary"
              : "bg-primary text-primary-foreground",
          )}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

/**
 * Section heading in the sidebar. On the collapsed rail there is no room for
 * the words and no room to lose the grouping either, so CSS reduces this same
 * element to the hairline it was implying — see `[data-nav-group]` in
 * globals.css.
 */
export function NavGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-nav-group
      className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
    >
      {children}
    </p>
  );
}
