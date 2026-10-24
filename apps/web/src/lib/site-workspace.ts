/**
 * Sites as workspaces, the way birdev opens a project: the whole agency (the
 * dashboard and everything across sites) or one site with its own overview and
 * sidebar: roster, attendance, guards, SOS and settings for that gate alone. The
 * top bar's switcher moves between them, keeping the section.
 *
 * Client-safe: plain data and pure helpers. The console layout loads the sites.
 */

import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarRange,
  FileSpreadsheet,
  LayoutDashboard,
  MapPinned,
  NotebookPen,
  Radar,
  Route,
  Settings2,
  Siren,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceSite = { id: string; name: string; district: string | null; client: string | null; active: boolean };

/**
 * A site's sidebar: the same groups and pages as the whole agency's, each showing
 * that site alone, so moving between "all sites" and one site changes the data, not
 * the menu. Overview and Boundary & settings are the site's own.
 */
export const SITE_GROUPS: { label: string | null; items: { key: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: null,
    items: [
      { key: "", label: "Overview", icon: LayoutDashboard },
      { key: "settings", label: "Boundary & settings", icon: Settings2 },
    ],
  },
  {
    label: "Location tracking",
    items: [
      { key: "live", label: "Live tracking", icon: Radar },
      { key: "routes", label: "Route history", icon: Route },
    ],
  },
  {
    label: "Shift management",
    items: [
      { key: "roster", label: "Roster", icon: CalendarRange },
      { key: "replacements", label: "Replacements", icon: ArrowLeftRight },
      { key: "handover", label: "Handover notes", icon: NotebookPen },
    ],
  },
  {
    label: "Security management",
    items: [
      { key: "guards", label: "Guards", icon: UserRound },
      { key: "devices", label: "Devices", icon: Smartphone },
      { key: "sos", label: "SOS alerts", icon: Siren },
    ],
  },
  {
    label: "Attendance",
    items: [
      { key: "attendance", label: "Attendance", icon: CalendarCheck },
      { key: "reports", label: "Reports", icon: FileSpreadsheet },
    ],
  },
];

export const SITE_SECTIONS = SITE_GROUPS.flatMap((g) => g.items);

/** Sections the site's own page renders; the rest are their own routes under the site. */
export const SITE_SECTION_KEYS = ["", "roster", "attendance", "guards", "sos", "settings"];


export const SITE_PATH = /^\/console\/sites\/([0-9a-f-]{36})(?:\/([a-z]+))?/i;

export function siteHref(id: string, section = ""): string {
  return `/console/sites/${id}${section ? `/${section}` : ""}`;
}

/** The site and section the path is in, or null outside a site. */
export function siteFromPath(pathname: string): { id: string; section: string } | null {
  const m = pathname.match(SITE_PATH);
  return m ? { id: m[1]!.toLowerCase(), section: m[2] ?? "" } : null;
}

/** The sidebar while inside a site, then the way back out to the whole agency. */
export const AGENCY_LINKS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/console", label: "All sites dashboard", icon: LayoutDashboard, exact: true },
  { href: "/console/sites", label: "Sites & geofences", icon: MapPinned, exact: true },
];
