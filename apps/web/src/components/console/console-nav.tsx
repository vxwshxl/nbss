"use client";

import { roleAllowed } from "@nbss/shared/identity";
import { useState } from "react";
import { usePathname } from "next/navigation";

import { groups } from "@/components/console/nav-items";
import { NavGroupLabel, NavLink } from "@/components/shell/nav-link";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Each sidebar section has its own hue (globals.css .hue-*), as in birdev's console. */
const SECTION_HUES = ["hue-jade", "hue-sky", "hue-gold", "hue-teal", "hue-plum", "hue-brick"];

/**
 * The console's navigation, rendered.
 *
 * Only the rendering is here. The destinations themselves, and the pure helpers
 * over them, live in `nav-items.ts` so the Server Component layout can call
 * them — see the note at the top of that file.
 */
export function ConsoleNav({
  role,
  badges = {},
}: {
  role: Role;
  /** Unactioned counts keyed by href — new enquiries, attendance to review. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  // The row that was just clicked lights up at once, before the new page has
  // arrived — the click is answered in the same frame, and the skeleton below
  // fills in behind it. Cleared the moment the path actually changes.
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const target = pending && pending.from === pathname ? pending.href : null;

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group, gi) => {
        const visible = group.items.filter((i) => !i.roles || roleAllowed(role, i.roles));
        if (visible.length === 0) return null;
        return (
          <div key={group.label ?? gi} className={cn("flex flex-col gap-0.5", SECTION_HUES[gi % SECTION_HUES.length])}>
            {group.label && <NavGroupLabel>{group.label}</NavGroupLabel>}
            {visible.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={
                  item.away
                    ? false
                    : target
                      ? target === item.href
                      : item.exact
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(`${item.href}/`)
                }
                onNavigate={item.away ? undefined : () => setPending({ href: item.href, from: pathname })}
                badge={badges[item.href]}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
