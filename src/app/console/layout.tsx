import type { Metadata } from "next";

import { signOut } from "@/app/console/actions";
import { stopImpersonation } from "@/app/console/impersonate";
import { ConsoleHeader, type Person } from "@/components/console/ConsoleHeader";
import { ImpersonationBar } from "@/components/console/ImpersonationBar";
import { Sidebar, type NavGroup } from "@/components/console/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { currentSession, homeFor } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth";

import "@/components/ui/ui.css";
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
  const account: NavGroup = {
    label: "Account",
    items: [{ href: "/console/profile", label: "My profile", icon: "user-shield" }],
  };

  // Last in every role's nav, because it is the way out rather than a place to
  // work. Kept as its own section so it never reads as part of the account.
  const website: NavGroup = {
    label: "Website",
    items: [{ href: "/", label: "Main site", icon: "home", away: true }],
  };

  if (role === "guard") {
    return [
      {
        label: "My shift",
        items: [
          { href: "/console/duty", label: "Today", icon: "clock" },
          { href: "/console/attendance", label: "My attendance", icon: "check" },
        ],
      },
      account,
      website,
    ];
  }

  if (role === "client") {
    return [
      {
        label: "My site",
        items: [{ href: "/console/site", label: "Deployment", icon: "building" }],
      },
      account,
      website,
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

  groups.push(account, website);

  return groups;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  // The sign-in page lives under /console but has no shell of its own. Rather
  // than redirect here — which would fight the middleware — an unauthenticated
  // render just passes the children straight through.
  if (!session) return <>{children}</>;

  const { profile, realProfile, impersonating } = session;

  // The impersonation picker needs the roster. Only an admin ever sees it, so
  // it is only fetched for one — and on the admin client, because an admin
  // already viewing as a guard would otherwise be filtered by that guard's
  // row-level policy and find the list empty.
  const people: Person[] =
    realProfile.role === "admin"
      ? ((
          await supabaseAdmin()
            .from("profiles")
            .select("id, employee_code, full_name, role")
            .eq("active", true)
            .neq("id", realProfile.id)
            .order("full_name")
        ).data ?? [])
      : [];

  return (
    <ToastProvider>
      <div className={`console${impersonating ? " is-viewing-as" : ""}`}>
        {impersonating && (
          <ImpersonationBar
            name={profile.full_name}
            code={profile.employee_code}
            role={ROLE_LABEL[profile.role]}
            adminName={realProfile.full_name}
            stop={stopImpersonation}
          />
        )}

        <div className="console__grid">
          <Sidebar
            groups={navFor(profile.role)}
            role={ROLE_LABEL[profile.role]}
            home={homeFor(profile.role)}
          />
          <div className="cmain">
            <ConsoleHeader
              name={profile.full_name}
              role={profile.role}
              code={profile.employee_code}
              isAdmin={realProfile.role === "admin"}
              impersonating={impersonating}
              realName={realProfile.full_name}
              people={people}
              signOut={signOut}
            />
            <main id="main">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
