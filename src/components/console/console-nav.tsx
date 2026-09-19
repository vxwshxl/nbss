"use client";

import { usePathname } from "next/navigation";

import { groups } from "@/components/console/nav-items";
import { NavGroupLabel, NavLink } from "@/components/shell/nav-link";
import type { Role } from "@/lib/auth";

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

  return (
    <nav className="flex flex-col gap-3">
      {groups.map((group, gi) => {
        const visible = group.items.filter((i) => !i.roles || i.roles.includes(role));
        if (visible.length === 0) return null;
        return (
          <div key={group.label ?? gi} className="flex flex-col gap-0.5">
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
                    : item.exact
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)
                }
                badge={badges[item.href]}
              />
            ))}
          </div>
        );
      })}
    </nav>
  );
}
