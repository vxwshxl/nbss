import type { Metadata } from "next";

import { signOut } from "@/app/console/actions";
import { Sidebar, type NavGroup } from "@/components/console/Sidebar";
import { currentProfile } from "@/lib/auth";
import type { Role } from "@/lib/auth";

import "./console.css";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s — NBSS Operations" },
  robots: { index: false, follow: false },
};

/** Reads live data on every request, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * The navigation each role is given.
 *
 * Built on the server from the signed-in profile, so a guard's browser is never
 * sent the admin routes at all. That is presentation, not protection — every
 * page behind these links calls `requireRole` for itself, because a nav that
 * omits a link does not stop anyone typing the URL.
 */
function navFor(role: Role): NavGroup[] {
  if (role === "guard") {
    return [
      {
        label: "My shift",
        items: [
          { href: "/console/duty", label: "Today", icon: "clock" },
          { href: "/console/attendance", label: "My attendance", icon: "check" },
        ],
      },
    ];
  }

  if (role === "client") {
    return [
      {
        label: "My site",
        items: [{ href: "/console/site", label: "Deployment", icon: "building" }],
      },
    ];
  }

  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        { href: "/console", label: "Dashboard", icon: "layers" },
        { href: "/console/attendance", label: "Attendance", icon: "check" },
        { href: "/console/sites", label: "Sites", icon: "building" },
      ],
    },
    {
      label: "People",
      items: [{ href: "/console/guards", label: "Guards", icon: "user-shield" }],
    },
    {
      label: "Desk",
      items: [{ href: "/console/submissions", label: "Submissions", icon: "mail" }],
    },
  ];

  if (role === "admin") {
    groups.push({
      label: "Administration",
      items: [{ href: "/console/audit", label: "Audit log", icon: "key" }],
    });
  }

  return groups;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const profile = await currentProfile();

  // The sign-in page lives under /console but has no shell of its own. Rather
  // than redirect here — which would fight the middleware — an unauthenticated
  // render just passes the children straight through.
  if (!profile) return <>{children}</>;

  return (
    <div className="console">
      <div className="console__grid">
        <Sidebar
          groups={navFor(profile.role)}
          name={profile.full_name}
          role={ROLE_LABEL[profile.role]}
          code={profile.employee_code}
          signOut={signOut}
        />
        <main className="cmain" id="main">{children}</main>
      </div>
    </div>
  );
}
