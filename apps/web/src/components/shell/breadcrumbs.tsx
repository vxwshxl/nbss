"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNavItem, type NavIndexItem } from "./nav-index";

/**
 * Where the reader is standing, as three layers at most: console → section →
 * screen. Entries that would repeat the one before them are dropped, so a
 * top-level page reads "SchoolERP › Dashboard" rather than
 * "SchoolERP › Dashboard › Dashboard".
 */
export function Breadcrumbs({
  brand,
  rootHref,
  index,
  className,
}: {
  brand: string;
  rootHref: string;
  index: NavIndexItem[];
  className?: string;
}) {
  const pathname = usePathname();
  const active = findNavItem(index, pathname, rootHref);

  const trail: { label: string; href?: string }[] = [
    { label: brand, href: rootHref },
  ];
  if (active) {
    if (active.group && active.group !== active.label) {
      trail.push({ label: active.group });
    }
    if (active.label !== brand) trail.push({ label: active.label });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 flex-1 items-center gap-1", className)}
    >
      {trail.map((crumb, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/40"
                strokeWidth={2}
              />
            )}
            {crumb.href && !last ? (
              <Link
                href={crumb.href}
                className="rounded-sm text-xs font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={cn(
                  "min-w-0 truncate text-xs",
                  last
                    ? "font-semibold text-foreground"
                    : "font-medium text-muted-foreground",
                )}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
