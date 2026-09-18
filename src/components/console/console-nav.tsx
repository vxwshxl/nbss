"use client";

import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MapPinned,
  ScrollText,
  ShieldUser,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";

import { NavGroupLabel, NavLink } from "@/components/shell/nav-link";
import type { NavIndexItem } from "@/components/shell/nav-index";
import type { Role } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that may see the item. Omitted means everybody. */
  roles?: Role[];
  exact?: boolean;
  /** Leaves the console. Gets an arrow, and never matches as active. */
  away?: boolean;
};

type NavGroup = { label?: string; items: NavItem[] };

/**
 * The console's navigation, in one list.
 *
 * Every destination declares which roles may reach it, rather than each role
 * declaring its own menu. Four hand-written menus is how a route ends up in
 * three of them and missing from the fourth after a rename — and this product
 * has four audiences whose screens genuinely overlap: a supervisor and an admin
 * share almost everything, a guard and a client share almost nothing.
 *
 * This is presentation, not protection. A nav that omits a link does not stop
 * anyone typing the URL, so every page behind these links calls `requireRole`
 * for itself, next to the data it is protecting, where it cannot drift out of
 * step with a route rename.
 */
const groups: NavGroup[] = [
  {
    items: [
      {
        href: "/console",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "supervisor"],
        exact: true,
      },
      // The guard's and the client's landing screens. Each is that role's
      // entire reason for having a login, so each sits alone at the top rather
      // than inside a section of one.
      { href: "/console/duty", label: "Today's duty", icon: Timer, roles: ["guard"] },
      { href: "/console/site", label: "My site", icon: Building2, roles: ["client"] },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/console/attendance",
        label: "Attendance",
        icon: CalendarCheck,
        roles: ["admin", "supervisor", "guard"],
      },
      {
        href: "/console/sites",
        label: "Sites & geofences",
        icon: MapPinned,
        roles: ["admin", "supervisor"],
      },
      {
        href: "/console/guards",
        label: "Guards",
        icon: ShieldUser,
        roles: ["admin", "supervisor"],
      },
    ],
  },
  {
    label: "Desk",
    items: [
      {
        href: "/console/submissions",
        label: "Enquiries",
        icon: Inbox,
        roles: ["admin", "supervisor"],
      },
    ],
  },
  {
    label: "Ask",
    items: [
      // Every role, because every role has a different question and the same
      // answer surface. A guard asks "how many hours did I work this week", a
      // client asks "is anyone on my gate", an admin asks "which sites are
      // empty" — and each of those is answered from tools that only that role
      // is offered. See `lib/ai/tools`.
      { href: "/console/assistant", label: "Assistant", icon: Sparkles },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/console/audit", label: "Audit log", icon: ScrollText, roles: ["admin"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/console/profile", label: "My profile", icon: UserRound },
      // Last in every role's nav, because it is the way out rather than a place
      // to work. Its own section so it never reads as part of the account.
      { href: "/", label: "Main website", icon: ExternalLink, away: true },
    ],
  },
];

/** Every destination in the console, flat, for the breadcrumbs and the palette. */
export const CONSOLE_NAV_INDEX: NavIndexItem[] = groups.flatMap((group) =>
  group.items
    .filter((item) => !item.away)
    .map((item) => ({
      href: item.href,
      label: item.label,
      group: group.label,
      exact: item.exact,
    })),
);

/** The subset of the index this role can actually reach. */
export function navIndexFor(role: Role): NavIndexItem[] {
  const allowed = new Set(
    groups
      .flatMap((g) => g.items)
      .filter((i) => !i.away && (!i.roles || i.roles.includes(role)))
      .map((i) => i.href),
  );
  return CONSOLE_NAV_INDEX.filter((i) => allowed.has(i.href));
}

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

/** The icon the dashboard and the command palette use for a given section. */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  "/console": LayoutDashboard,
  "/console/attendance": CalendarCheck,
  "/console/sites": MapPinned,
  "/console/guards": ShieldUser,
  "/console/submissions": Inbox,
  "/console/assistant": Sparkles,
  "/console/audit": ScrollText,
  "/console/profile": UserRound,
  "/console/duty": Timer,
  "/console/site": Building2,
  "/console/shifts": ClipboardList,
};
