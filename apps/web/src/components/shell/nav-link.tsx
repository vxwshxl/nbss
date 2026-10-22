"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One row of console navigation, shared by the tenant, platform-admin and agent
 * sidebars — they had three byte-identical copies of this markup, which is how
 * a focus ring ends up on two of them.
 *
 * The icon sits in a tinted tile rather than loose in the row, in the hue of
 * the section it belongs to (the group sets .hue-*), so a destination is found
 * again by colour and shape rather than by re-reading the list.
 */
export function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** Pending/unseen count. Becomes a dot when the sidebar is a rail. */
  badge?: number;
  /** Called on a plain click, so the nav can show the row as active at once. */
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      data-active={active || undefined}
      data-rail-compact
      // The label is the tooltip only on the rail, where it is the sole thing
      // identifying the row; leaving it on at full width would put a native
      // tooltip over text that is already legible.
      title={label}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        onNavigate?.();
      }}
      // birdev's sidebar: each section has its own hue (set on the group as .hue-*); the
      // icon sits on that hue's soft wash, and the active row takes the wash with the
      // icon tile turned solid.
      className={cn(
        "group relative flex items-center gap-3 rounded-[14px] px-2 py-1.5 text-[15px] font-medium outline-none transition-[background-color,color,translate,box-shadow] active:translate-y-px",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring/60",
        active
          ? "bg-[var(--h-soft)] text-[var(--h-deep)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--h)_22%,transparent)]"
          : "text-secondary-fg hover:bg-muted hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[10px] transition-[background-color,color,transform] duration-200 group-hover:-rotate-6",
          active ? "bg-[var(--h)] text-white shadow-[0_6px_14px_-6px_var(--h)]" : "bg-[var(--h-soft)] text-[var(--h-deep)]",
        )}
      >
        <Icon className="size-[17px]" strokeWidth={1.9} />
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
            "bg-gold text-ink",
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
      className="mb-1 truncate px-3 text-[13px] font-semibold text-secondary-fg"
    >
      {children}
    </p>
  );
}
