/**
 * Sites as workspaces, the way birdev opens a project: the whole agency (the
 * dashboard and everything across sites) or one site with its own overview and
 * sidebar: roster, attendance, guards, SOS and settings for that gate alone. The
 * top bar's switcher moves between them, keeping the section.
 *
 * Client-safe: plain data and pure helpers. The console layout loads the sites.
 */

import {
  CalendarCheck,
  CalendarRange,
  LayoutDashboard,
  MapPinned,
  Settings2,
  Siren,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceSite = { id: string; name: string; district: string | null; client: string | null; active: boolean };

export const SITE_SECTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "", label: "Overview", icon: LayoutDashboard },
  { key: "roster", label: "Roster", icon: CalendarRange },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "guards", label: "Guards", icon: UserRound },
  { key: "sos", label: "SOS alerts", icon: Siren },
  { key: "settings", label: "Boundary & settings", icon: Settings2 },
];

export const SITE_SECTION_KEYS = SITE_SECTIONS.map((s) => s.key);

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
