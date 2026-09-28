/**
 * Which tables each console screen actually shows — so a live change only
 * refreshes the pages that would look different, and screens where a refresh
 * would get in the way (a form being filled, the assistant, a fence being
 * drawn) never refresh on their own.
 *
 * First matching prefix wins. "off" means no live refresh on that screen.
 */
export type RouteRealtime = readonly string[] | "off";

const ROUTES: [prefix: string, tables: RouteRealtime][] = [
  ["/console/assistant", "off"],
  ["/console/profile", "off"],
  ["/console/sites/", "off"], // editing one site's fence
  ["/console/attendance", ["attendance", "shifts"]],
  ["/console/sites", ["sites", "attendance", "sos_alerts"]],
  ["/console/sos", ["sos_alerts", "attendance"]],
  ["/console/roster", ["shifts", "site_postings", "attendance", "sites"]],
  ["/console/guards", ["profiles", "attendance"]],
  ["/console/users", ["profiles"]],
  ["/console/submissions", ["submissions"]],
  ["/console/bookings", ["service_requests"]],
  ["/console/book", ["service_requests"]],
  ["/console/duty", ["attendance", "shifts", "sites"]],
  ["/console/site", ["attendance", "shifts", "sites", "sos_alerts"]],
  ["/console/audit", ["profiles"]],
];

const EXACT: Record<string, RouteRealtime> = {
  "/console": ["attendance", "sites", "submissions", "service_requests", "sos_alerts", "profiles", "shifts"],
};

export function tablesForRoute(pathname: string): RouteRealtime {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (EXACT[path]) return EXACT[path];
  for (const [prefix, tables] of ROUTES) {
    if (path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)) return tables;
  }
  return [];
}

/** Everything any console screen listens to. One channel carries them all. */
export const CONSOLE_REALTIME_TABLES = [
  "attendance",
  "shifts",
  "sites",
  "profiles",
  "submissions",
  "service_requests",
  "sos_alerts",
  "site_postings",
] as const;
