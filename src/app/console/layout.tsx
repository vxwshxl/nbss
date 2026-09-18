import type { Metadata } from "next";
import { cookies } from "next/headers";

import { signOut } from "@/app/console/actions";
import { startImpersonation, stopImpersonation } from "@/app/console/impersonate";
import { Wordmark } from "@/components/brand";
import { ConsoleNav, navIndexFor } from "@/components/console/console-nav";
import {
  ImpersonationBanner,
  ImpersonationPicker,
  ROLE_LABEL,
  type Person,
} from "@/components/console/impersonation";
import { UserMenu } from "@/components/console/user-menu";
import { AppShell, RAIL_COOKIE } from "@/components/shell/app-shell";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentSession, homeFor } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: { default: "Console", template: `%s · ${site.shortName} Console` },
  robots: { index: false, follow: false },
};

/** Reads live data on every request, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * The console shell.
 *
 * The nav is built on the server from the signed-in profile, so a guard's
 * browser is never sent the admin routes at all. That is presentation, not
 * protection — every page behind these links calls `requireRole` for itself.
 *
 * The rail-collapse preference is read here rather than in the client, so the
 * first paint is already the right width. A cookie rather than localStorage for
 * exactly that reason: the server cannot read localStorage, and a rail that
 * expands on hydration is a page that jumps under the reader.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [session, jar] = await Promise.all([currentSession(), cookies()]);

  // The sign-in page lives under /console but has no shell of its own. Rather
  // than redirect here — which would fight the middleware — an unauthenticated
  // render passes the children straight through.
  if (!session) return <>{children}</>;

  const { profile, realProfile, impersonating } = session;
  const railCollapsed = jar.get(RAIL_COOKIE)?.value === "1";
  const isAdmin = realProfile.role === "admin";

  // The impersonation picker needs the roster. Only an admin ever sees it, so
  // it is only fetched for one — and on the admin client, because an admin
  // already viewing as a guard would otherwise be filtered by that guard's
  // row-level policy and find the list empty.
  const people: Person[] = isAdmin
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
    <AppShell
      brand={site.shortName}
      brandHref={homeFor(profile.role)}
      assistantHref={
        profile.role === "admin" || profile.role === "supervisor"
          ? "/console/assistant"
          : undefined
      }
      navIndex={navIndexFor(profile.role)}
      defaultCollapsed={railCollapsed}
      mark={<Wordmark secondary={ROLE_LABEL[profile.role]} size={32} priority />}
      nav={<ConsoleNav role={profile.role} />}
      banner={
        impersonating ? (
          <ImpersonationBanner
            name={profile.full_name}
            code={profile.employee_code}
            role={profile.role}
            adminName={realProfile.full_name}
            stop={stopImpersonation}
          />
        ) : undefined
      }
      topbarSecondary={
        <>
          {/* Only offered to an admin who is not already viewing as someone —
              chaining impersonation is refused by the action anyway, and a
              control that always fails is worse than no control. */}
          {isAdmin && !impersonating && (
            <ImpersonationPicker people={people} start={startImpersonation} />
          )}
          <ThemeSwitch />
        </>
      }
      topbarRight={
        <UserMenu
          name={profile.full_name}
          code={profile.employee_code}
          roleLabel={ROLE_LABEL[profile.role]}
          signOut={signOut}
        />
      }
    >
      {children}
    </AppShell>
  );
}
