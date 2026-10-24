import { roleAllowed } from "@nbss/shared/identity";
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  Inbox,
  KeyRound,
  LayoutDashboard,
  MapPinned,
  NotebookPen,
  Radar,
  ReceiptIndianRupee,
  Route,
  ScrollText,
  Siren,
  Smartphone,
  Sparkles,
  Timer,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { NavIndexItem } from "@/components/shell/nav-index";
import type { Role } from "@/lib/auth";

/**
 * The console's navigation, as data.
 *
 * Deliberately NOT a `"use client"` module, and that is the whole reason this
 * file exists separately from `console-nav.tsx`.
 *
 * In the RSC model every export of a `"use client"` module becomes a *client
 * reference* — a stub the server can render or pass as a prop, but cannot call.
 * `navIndexFor` is a plain function over plain strings, and the console layout
 * is a Server Component that calls it to build the breadcrumb index. Leaving it
 * beside the component meant the layout was trying to invoke a stub, which
 * failed at runtime with "Attempted to call navIndexFor() from the server".
 *
 * So the data and the pure helpers live here, where both sides may import them,
 * and only the rendering lives behind the client boundary.
 */
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
export const groups: NavGroup[] = [
  {
    items: [
      {
        href: "/console",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["admin", "supervisor"],
        exact: true,
      },
      // The website's forms, right under the dashboard: new ones carry a badge until
      // someone marks them contacted or closed.
      { href: "/console/submissions", label: "Enquiries", icon: Inbox, roles: ["admin", "supervisor"] },
      // The guard's and the client's landing screens. Each is that role's
      // entire reason for having a login, so each sits alone at the top rather
      // than inside a section of one.
      { href: "/console/duty", label: "Today's duty", icon: Timer, roles: ["guard"] },
      { href: "/console/site", label: "My site", icon: Building2, roles: ["client"] },
      { href: "/console/book", label: "Book guards", icon: CalendarPlus, roles: ["client"] },
    ],
  },
  // The four modules the desk works in, named as the agency names them. Each is
  // one job: where the guards are, who is on which shift, the people and phones
  // doing the guarding, and the hours that payroll and billing come from.
  {
    label: "Location tracking",
    items: [
      { href: "/console/live", label: "Live tracking", icon: Radar, roles: ["admin", "supervisor"] },
      { href: "/console/routes", label: "Route history", icon: Route, roles: ["admin", "supervisor"] },
      { href: "/console/sites", label: "Sites & geofences", icon: MapPinned, roles: ["admin", "supervisor"] },

    ],
  },
  {
    label: "Shift management",
    items: [
      { href: "/console/roster", label: "Roster", icon: CalendarRange, roles: ["admin", "supervisor"] },
      { href: "/console/replacements", label: "Replacements", icon: ArrowLeftRight, roles: ["admin", "supervisor"] },
      { href: "/console/handover", label: "Handover notes", icon: NotebookPen, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Security management",
    items: [
      { href: "/console/guards", label: "Guards", icon: UserRound, roles: ["admin", "supervisor"] },
      { href: "/console/devices", label: "Devices", icon: Smartphone, roles: ["admin", "supervisor"] },
      { href: "/console/sos", label: "SOS alerts", icon: Siren, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Attendance",
    items: [
      {
        href: "/console/attendance",
        label: "Attendance",
        icon: CalendarCheck,
        roles: ["admin", "supervisor", "guard"],
      },
      { href: "/console/reports", label: "Reports", icon: FileSpreadsheet, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/console/software-fee", label: "Software fee", icon: ReceiptIndianRupee, roles: ["admin"] },
      { href: "/console/maps-usage", label: "Maps usage", icon: Gauge, roles: ["admin"] },
    ],
  },
  {
    label: "Desk",
    items: [
      {
        href: "/console/bookings",
        label: "Bookings",
        icon: ClipboardList,
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
      { href: "/console/users", label: "Users", icon: Users, roles: ["admin", "supervisor"] },
      { href: "/console/roles", label: "Roles", icon: KeyRound, roles: ["admin", "supervisor"] },
      { href: "/console/audit", label: "Audit log", icon: ScrollText, roles: ["admin"] },
      { href: "/console/guide", label: "Guide", icon: BookOpen, roles: ["admin"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/console/profile", label: "My profile", icon: UserRound },
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
      .filter((i) => !i.away && (!i.roles || roleAllowed(role, i.roles)))
      .map((i) => i.href),
  );
  return CONSOLE_NAV_INDEX.filter((i) => allowed.has(i.href));
}


/** Every page a role can open, by group, for the Roles page. */
export function pagesFor(role: Role): { group: string; pages: string[] }[] {
  return groups
    .map((g) => ({
      group: g.label ?? "Home",
      pages: g.items.filter((i) => !i.away && (!i.roles || roleAllowed(role, i.roles))).map((i) => i.label),
    }))
    .filter((g) => g.pages.length > 0);
}
